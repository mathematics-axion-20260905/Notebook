from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from .models import NotebookDocument, NotebookExecutionJob, NotebookExecutionRecord, NotebookSnapshot


User = get_user_model()


def sample_blocks(content="sin(x)"):
    return [
        {
            "id": "solve-1",
            "kind": "solve",
            "title": "Integral",
            "content": content,
            "config": {"variable": "x", "lower": "0", "upper": "1", "method": "auto"},
        }
    ]


class NotebookPermissionTests(APITestCase):
    def test_health_probe(self):
        response = self.client.get("/healthz/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], "ok")

    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="owner-pass")
        self.public_doc = NotebookDocument.objects.create(
            owner=self.owner,
            title="Public",
            summary="Readable",
            visibility=NotebookDocument.VISIBILITY_PUBLIC_READ,
            blocks=sample_blocks(),
        )
        self.private_doc = NotebookDocument.objects.create(
            owner=self.owner,
            title="Private",
            summary="Hidden",
            visibility=NotebookDocument.VISIBILITY_PRIVATE,
            blocks=sample_blocks("x"),
        )

    def test_anonymous_user_sees_only_public_notebooks_and_cannot_create(self):
        response = self.client.get("/api/notebook/documents/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = {item["title"] for item in response.json()}
        self.assertEqual(titles, {"Public"})

        create_response = self.client.post("/api/notebook/documents/", {
            "title": "Blocked",
            "summary": "No auth",
            "visibility": "private",
            "blocks": sample_blocks(),
            "metadata": {},
        }, format="json")
        self.assertIn(create_response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_project_filter_returns_only_matching_documents(self):
        self.client.force_authenticate(self.owner)
        NotebookDocument.objects.create(
            owner=self.owner,
            title="Project A",
            visibility=NotebookDocument.VISIBILITY_PRIVATE,
            blocks=sample_blocks(),
            metadata={"project_id": "project-a"},
        )
        NotebookDocument.objects.create(
            owner=self.owner,
            title="Project B",
            visibility=NotebookDocument.VISIBILITY_PRIVATE,
            blocks=sample_blocks(),
            metadata={"project_id": "project-b"},
        )

        response = self.client.get("/api/notebook/documents/?project=project-a")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({item["title"] for item in response.json()}, {"Project A"})

    def test_project_filter_keeps_selected_legacy_document_available(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(
            f"/api/notebook/documents/?project=project-a&document={self.private_doc.public_id}"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({item["title"] for item in response.json()}, {"Private"})


class NotebookMutationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="writer", password="writer-pass")
        self.client.force_authenticate(self.user)
        self.document = NotebookDocument.objects.create(
            owner=self.user,
            title="Working notebook",
            summary="Draft",
            visibility=NotebookDocument.VISIBILITY_PRIVATE,
            blocks=sample_blocks(),
            metadata={"schema_version": 1},
        )

    def test_named_snapshot_and_restore_round_trip(self):
        snapshot_response = self.client.post(
            f"/api/notebook/documents/{self.document.public_id}/snapshots/",
            {"label": "Known good", "source": "checkpoint", "is_named": True},
            format="json",
        )
        self.assertEqual(snapshot_response.status_code, status.HTTP_201_CREATED)
        snapshot_id = snapshot_response.json()["id"]
        self.assertTrue(NotebookSnapshot.objects.filter(public_id=snapshot_id).exists())

        update_response = self.client.put(
            f"/api/notebook/documents/{self.document.public_id}/",
            {
                "title": "Working notebook",
                "summary": "Changed",
                "visibility": "private",
                "blocks": sample_blocks("x**3"),
                "metadata": {"schema_version": 1},
                "is_locked": False,
            },
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)

        restore_response = self.client.post(
            f"/api/notebook/documents/{self.document.public_id}/restore/",
            {"snapshot_id": snapshot_id},
            format="json",
        )
        self.assertEqual(restore_response.status_code, status.HTTP_200_OK)
        restored_blocks = restore_response.json()["blocks"]
        self.assertEqual(restored_blocks[0]["content"], "sin(x)")

    def test_scientific_object_reference_survives_document_save(self):
        blocks = [
            {
                "id": "result-1",
                "kind": "result",
                "title": "Math result",
                "content": "A pinned result",
                "scientific_object_reference": {
                    "projectId": "project-1",
                    "objectId": "object-1",
                    "mode": "pinned",
                    "revision": 2,
                },
            },
        ]
        response = self.client.put(
            f"/api/notebook/documents/{self.document.public_id}/",
            {
                "title": self.document.title,
                "summary": self.document.summary,
                "visibility": self.document.visibility,
                "blocks": blocks,
                "metadata": {"schema_version": 1},
                "is_locked": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        reference = response.json()["blocks"][0]["scientific_object_reference"]
        self.assertEqual(reference["objectId"], "object-1")
        self.assertEqual(reference["revision"], 2)

    def test_execution_submission_is_queued_and_worker_processes_job(self):
        response = self.client.post(
            "/api/notebook/execution/submit/",
            {
                "document_id": str(self.document.public_id),
                "block_id": "solve-1",
                "kind": "solve",
                "title": "Integral",
                "content": "sin(x)",
                "config": {"variable": "x", "lower": "0", "upper": "1", "method": "auto"},
                "execution_target": "external-server",
                "scientific_object_reference": {
                    "projectId": "project-1",
                    "objectId": "object-1",
                    "mode": "pinned",
                    "revision": 2,
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        job_id = response.json()["id"]
        job = NotebookExecutionJob.objects.get(public_id=job_id)
        self.assertEqual(job.status, NotebookExecutionJob.STATUS_QUEUED)
        self.assertEqual(job.inputs["execution_target"], "external-server")
        self.assertEqual(job.inputs["scientific_object_reference"]["objectId"], "object-1")

        call_command("process_execution_jobs", "--once")

        job.refresh_from_db()
        self.assertEqual(job.status, NotebookExecutionJob.STATUS_SUCCESS)
        self.assertTrue(NotebookExecutionRecord.objects.filter(document=self.document, block_id="solve-1").exists())

    def test_execution_validation_rejects_oversized_graph_requests(self):
        response = self.client.post(
            "/api/notebook/execution/submit/",
            {
                "document_id": str(self.document.public_id),
                "block_id": "graph-1",
                "kind": "graph",
                "title": "Huge graph",
                "content": "sin(x)",
                "config": {"xMin": "0", "xMax": "10", "samples": "5000"},
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        call_command("process_execution_jobs", "--once")

        job = NotebookExecutionJob.objects.get(block_id="graph-1")
        self.assertEqual(job.status, NotebookExecutionJob.STATUS_ERROR)
        self.assertIn("Graph sample cap", job.detail)
