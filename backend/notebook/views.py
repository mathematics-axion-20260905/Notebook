import logging
import math
import time
from datetime import timedelta

import numpy as np
import sympy as sp
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import (
    NotebookDocument,
    NotebookExecutionJob,
    NotebookExecutionRecord,
    NotebookImportRecord,
    NotebookSnapshot,
)
from .permissions import CanReadOrEditNotebook
from .serializers import (
    CurrentUserSerializer,
    NotebookCapabilitySerializer,
    NotebookDocumentSerializer,
    NotebookExecuteSerializer,
    NotebookExecutionJobSerializer,
    NotebookExecutionRecordSerializer,
    NotebookImportRecordSerializer,
    NotebookRestoreSnapshotSerializer,
    NotebookSnapshotSerializer,
)


logger = logging.getLogger(__name__)
User = get_user_model()

CAPABILITIES = [
    {"kind": "text", "family": "document", "title": "Text", "runtime": "local", "supports_preview": True, "supports_execute": False, "supports_export": True},
    {"kind": "formula", "family": "math", "title": "Formula", "runtime": "local", "supports_preview": True, "supports_execute": False, "supports_export": True},
    {"kind": "solve", "family": "compute", "title": "Solve", "runtime": "hybrid", "supports_preview": True, "supports_execute": True, "supports_export": True},
    {"kind": "graph", "family": "compute", "title": "Graph", "runtime": "hybrid", "supports_preview": True, "supports_execute": True, "supports_export": True},
    {"kind": "table", "family": "compute", "title": "Table", "runtime": "hybrid", "supports_preview": True, "supports_execute": True, "supports_export": True},
    {"kind": "code", "family": "compute", "title": "Code", "runtime": "server-boundary", "supports_preview": True, "supports_execute": True, "supports_export": True},
    {"kind": "proof", "family": "document", "title": "Proof", "runtime": "local", "supports_preview": True, "supports_execute": False, "supports_export": True},
    {"kind": "exercise", "family": "document", "title": "Exercise", "runtime": "local", "supports_preview": True, "supports_execute": False, "supports_export": True},
    {"kind": "result", "family": "import", "title": "Result Import", "runtime": "local", "supports_preview": True, "supports_execute": False, "supports_export": True},
    {"kind": "export", "family": "publication", "title": "Export", "runtime": "local", "supports_preview": True, "supports_execute": False, "supports_export": True},
]

MAX_GRAPH_SAMPLES = 600
MAX_TABLE_ROWS = 50
MAX_EXPRESSION_LENGTH = 4000
MAX_EXECUTION_TIMEOUT_SECONDS = 25


def create_snapshot(document, *, source, label="", is_named=False):
    snapshot = NotebookSnapshot.objects.create(
        document=document,
        label=label,
        source=source,
        blocks=document.blocks,
        metadata=document.metadata,
        revision=document.revision,
        is_named=is_named,
    )
    autosaves = NotebookSnapshot.objects.filter(document=document, source="autosave", is_named=False).order_by("-created_at")
    stale_ids = list(autosaves.values_list("id", flat=True)[30:])
    if stale_ids:
        NotebookSnapshot.objects.filter(id__in=stale_ids).delete()
    return snapshot


def _safe_float(value, fallback):
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _validate_execution_request(payload):
    content = payload["content"]
    if len(content) > MAX_EXPRESSION_LENGTH:
        raise ValueError("Expression is too large.")
    kind = payload["kind"]
    config = payload.get("config") or {}
    if kind == "graph":
        samples = int(_safe_float(config.get("samples"), 160))
        if samples > MAX_GRAPH_SAMPLES:
            raise ValueError(f"Graph sample cap is {MAX_GRAPH_SAMPLES}.")
    if kind == "table":
        rows = int(_safe_float(config.get("rows"), 8))
        if rows > MAX_TABLE_ROWS:
            raise ValueError(f"Table row cap is {MAX_TABLE_ROWS}.")


def execute_block(payload):
    _validate_execution_request(payload)
    started = time.perf_counter()
    kind = payload["kind"]
    config = payload.get("config") or {}
    content = payload["content"]
    title = payload.get("title") or kind.title()
    x = sp.symbols(config.get("variable", "x"))
    expression = sp.sympify(content)
    cache_key = f"{kind}|{content}|{sorted(config.items())}"

    if kind == "solve":
        lower = sp.sympify(config.get("lower", "0"))
        upper = sp.sympify(config.get("upper", "1"))
        exact_value = sp.integrate(expression, (x, lower, upper))
        numeric_value = sp.N(exact_value, 12)
        output = {
            "status": "success",
            "summary": f"Integral solved for {title}",
            "exact_latex": sp.latex(exact_value),
            "numeric_value": str(numeric_value),
            "method": "sympy-definite-integral",
        }
    elif kind == "graph":
        x_min = _safe_float(config.get("xMin"), -5.0)
        x_max = _safe_float(config.get("xMax"), 5.0)
        samples = max(16, min(MAX_GRAPH_SAMPLES, int(_safe_float(config.get("samples"), 160))))
        xs = np.linspace(x_min, x_max, samples)
        fn = sp.lambdify(x, expression, "numpy")
        ys = np.asarray(fn(xs), dtype=float)
        output = {
            "status": "success",
            "summary": f"{samples} points sampled",
            "points": [{"x": float(xi), "y": float(yi)} for xi, yi in zip(xs.tolist(), ys.tolist()) if math.isfinite(float(yi))],
            "y_min": float(np.nanmin(ys)),
            "y_max": float(np.nanmax(ys)),
        }
    elif kind == "table":
        x_min = _safe_float(config.get("xMin"), 0.0)
        x_max = _safe_float(config.get("xMax"), 5.0)
        rows = max(2, min(MAX_TABLE_ROWS, int(_safe_float(config.get("rows"), 8))))
        xs = np.linspace(x_min, x_max, rows)
        fn = sp.lambdify(x, expression, "numpy")
        ys = np.asarray(fn(xs), dtype=float)
        output = {
            "status": "success",
            "summary": f"{rows} rows generated",
            "rows": [{"x": float(xi), "y": float(yi)} for xi, yi in zip(xs.tolist(), ys.tolist()) if math.isfinite(float(yi))],
        }
    elif kind == "code":
        output = {
            "status": "success",
            "summary": "Code cell queued for server-boundary execution.",
            "lines": len(content.splitlines()),
            "runtime_boundary": "server-boundary",
        }
    else:
        output = {"status": "success", "summary": f"{title} does not require execution."}

    duration_ms = int((time.perf_counter() - started) * 1000)
    return {
        "status": "success",
        "runtime": "hybrid" if kind in {"solve", "graph", "table", "code"} else "local",
        "cache_key": cache_key,
        "duration_ms": duration_ms,
        "detail": output.get("summary", ""),
        "output": output,
    }


def run_execution_job(job: NotebookExecutionJob):
    started_at = timezone.now()
    job.status = NotebookExecutionJob.STATUS_RUNNING
    job.started_at = started_at
    job.save(update_fields=["status", "started_at", "updated_at"])
    started_perf = time.perf_counter()
    try:
        result = execute_block({
            "kind": job.block_kind,
            "title": job.title,
            "content": job.inputs.get("content", ""),
            "config": job.inputs.get("config", {}),
        })
        job.status = NotebookExecutionJob.STATUS_SUCCESS
        job.runtime = result["runtime"]
        job.cache_key = result["cache_key"]
        job.detail = result["detail"]
        job.output = result["output"]
        job.duration_ms = int((time.perf_counter() - started_perf) * 1000)
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "runtime", "cache_key", "detail", "output", "duration_ms", "finished_at", "updated_at"])
        NotebookExecutionRecord.objects.create(
            document=job.document,
            block_id=job.block_id,
            block_kind=job.block_kind,
            title=job.title,
            status=job.status,
            runtime=job.runtime,
            cache_key=job.cache_key,
            detail=job.detail,
            inputs=job.inputs,
            output=job.output,
            duration_ms=job.duration_ms,
        )
        return job
    except Exception as error:
        job.status = NotebookExecutionJob.STATUS_ERROR
        job.detail = str(error)
        job.duration_ms = int((time.perf_counter() - started_perf) * 1000)
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "detail", "duration_ms", "finished_at", "updated_at"])
        NotebookExecutionRecord.objects.create(
            document=job.document,
            block_id=job.block_id,
            block_kind=job.block_kind,
            title=job.title,
            status=job.status,
            runtime=job.runtime,
            cache_key=job.cache_key,
            detail=job.detail,
            inputs=job.inputs,
            output=job.output,
            duration_ms=job.duration_ms,
        )
        return job


class NotebookDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = NotebookDocumentSerializer
    permission_classes = [CanReadOrEditNotebook]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    lookup_field = "public_id"
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "summary"]
    ordering_fields = ["created_at", "updated_at", "title"]
    ordering = ["-updated_at"]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "notebook_documents"

    def get_queryset(self):
        queryset = NotebookDocument.objects.select_related("owner")
        if self.request.user and self.request.user.is_authenticated:
            return queryset.filter(
                Q(owner=self.request.user) | Q(visibility=NotebookDocument.VISIBILITY_PUBLIC_READ)
            ).distinct()
        return queryset.filter(visibility=NotebookDocument.VISIBILITY_PUBLIC_READ)

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save(owner=self.request.user)
        create_snapshot(instance, source="autosave")
        logger.info("notebook_created", extra={"notebook_id": str(instance.public_id), "revision": instance.revision})

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.save(revision=serializer.instance.revision + 1)
        create_snapshot(instance, source="autosave")
        logger.info("notebook_updated", extra={"notebook_id": str(instance.public_id), "revision": instance.revision})

    @action(detail=True, methods=["get", "post"], url_path="snapshots")
    def snapshots(self, request, public_id=None):
        document = self.get_object()
        self.check_object_permissions(request, document)
        if request.method.lower() == "get":
            serializer = NotebookSnapshotSerializer(document.snapshots.all()[:50], many=True)
            return Response(serializer.data)
        payload = {
            "label": request.data.get("label", ""),
            "source": request.data.get("source", "checkpoint"),
            "blocks": document.blocks,
            "metadata": document.metadata,
            "revision": document.revision,
            "is_named": bool(request.data.get("is_named", True)),
        }
        serializer = NotebookSnapshotSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        snapshot = NotebookSnapshot.objects.create(document=document, **serializer.validated_data)
        return Response(NotebookSnapshotSerializer(snapshot).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, public_id=None):
        document = self.get_object()
        self.check_object_permissions(request, document)
        serializer = NotebookRestoreSnapshotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        snapshot = document.snapshots.get(public_id=serializer.validated_data["snapshot_id"])
        document.blocks = snapshot.blocks
        document.metadata = snapshot.metadata
        document.revision += 1
        document.save(update_fields=["blocks", "metadata", "revision", "updated_at"])
        create_snapshot(document, source="restore")
        return Response(NotebookDocumentSerializer(document, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="executions")
    def executions(self, request, public_id=None):
        document = self.get_object()
        self.check_object_permissions(request, document)
        serializer = NotebookExecutionRecordSerializer(document.execution_records.all()[:100], many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="imports")
    def imports(self, request, public_id=None):
        document = self.get_object()
        self.check_object_permissions(request, document)
        serializer = NotebookImportRecordSerializer(document.imports.all()[:50], many=True)
        return Response(serializer.data)


class NotebookExecutionSubmitView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "notebook_documents"

    def post(self, request):
        serializer = NotebookExecuteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        if "document_id" not in payload:
            return Response({"document_id": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        document = get_object_or_404(NotebookDocument, public_id=payload["document_id"], owner=request.user)
        job = NotebookExecutionJob.objects.create(
            document=document,
            submitted_by=request.user,
            block_id=payload["block_id"],
            block_kind=payload["kind"],
            title=payload.get("title", ""),
            inputs={
                "content": payload["content"],
                "config": payload.get("config", {}),
                "execution_target": payload.get("execution_target", "external-server"),
                "scientific_object_reference": payload.get("scientific_object_reference"),
            },
            timeout_seconds=MAX_EXECUTION_TIMEOUT_SECONDS,
        )
        if request.query_params.get("sync") == "1":
            run_execution_job(job)
            job.refresh_from_db()
        return Response(NotebookExecutionJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class NotebookExecutionJobView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        job = get_object_or_404(NotebookExecutionJob.objects.select_related("document"), public_id=job_id, document__owner=request.user)
        return Response(NotebookExecutionJobSerializer(job).data)


class NotebookCapabilitiesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(NotebookCapabilitySerializer(CAPABILITIES, many=True).data)


class CurrentSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(CurrentUserSerializer({
            "id": request.user.id,
            "username": request.user.get_username(),
            "is_authenticated": True,
        }).data)


class BootstrapDemoUserView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        """Issue a temporary shared guest session until product auth is introduced.

        This deliberately has no account or RBAC semantics. It is a staging
        bridge so the notebook can use its real persistence APIs without
        forcing an auth product decision yet.
        """
        username = "axion-guest"
        password = settings.NOTEBOOK_GUEST_PASSWORD
        user, created = User.objects.get_or_create(username=username)
        if created:
            user.set_password(password)
            user.save(update_fields=["password"])
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "status": "ready",
                "username": username,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
        )
