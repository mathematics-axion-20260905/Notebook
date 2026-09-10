from rest_framework import serializers

from .models import (
    NotebookDocument,
    NotebookExecutionJob,
    NotebookExecutionRecord,
    NotebookImportRecord,
    NotebookSnapshot,
)


ALLOWED_BLOCK_KINDS = {
    "text",
    "formula",
    "solve",
    "graph",
    "table",
    "python",
    "code",
    "theorem",
    "proof",
    "exercise",
    "answer",
    "export",
    "lab-result",
    "result",
}


def validate_block_payload(value):
    if not isinstance(value, list):
        raise serializers.ValidationError("blocks must be a list.")
    if len(value) > 250:
        raise serializers.ValidationError("A notebook can contain at most 250 blocks.")
    if len(str(value)) > 500000:
        raise serializers.ValidationError("Notebook blocks payload is too large.")

    for index, block in enumerate(value):
        if not isinstance(block, dict):
            raise serializers.ValidationError(f"Block {index + 1} must be an object.")
        kind = block.get("kind")
        if kind not in ALLOWED_BLOCK_KINDS:
            raise serializers.ValidationError(f"Block {index + 1} kind is invalid.")
        if not isinstance(block.get("id"), str) or not block["id"].strip():
            raise serializers.ValidationError(f"Block {index + 1} id is required.")
        if not isinstance(block.get("title"), str):
            raise serializers.ValidationError(f"Block {index + 1} title is required.")
        if not isinstance(block.get("content"), str):
            raise serializers.ValidationError(f"Block {index + 1} content is required.")
        config = block.get("config", {})
        if config is not None and not isinstance(config, dict):
            raise serializers.ValidationError(f"Block {index + 1} config must be an object.")
        reference = block.get("scientific_object_reference")
        if reference is not None:
            if not isinstance(reference, dict):
                raise serializers.ValidationError(f"Block {index + 1} scientific_object_reference must be an object.")
            if not isinstance(reference.get("projectId"), str) or not reference["projectId"].strip():
                raise serializers.ValidationError(f"Block {index + 1} reference projectId is required.")
            if not isinstance(reference.get("objectId"), str) or not reference["objectId"].strip():
                raise serializers.ValidationError(f"Block {index + 1} reference objectId is required.")
            if reference.get("mode") not in {"live", "pinned", "frozen"}:
                raise serializers.ValidationError(f"Block {index + 1} reference mode is invalid.")
    return value


class NotebookDocumentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    owner = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = NotebookDocument
        fields = [
            "id",
            "owner",
            "title",
            "summary",
            "visibility",
            "blocks",
            "metadata",
            "revision",
            "is_locked",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "revision", "created_at", "updated_at"]

    def get_owner(self, obj):
        if not obj.owner_id:
            return None
        return {
            "id": obj.owner_id,
            "username": obj.owner.get_username(),
        }

    def validate_blocks(self, value):
        return validate_block_payload(value)

    def validate_metadata(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("metadata must be an object.")
        if len(str(value)) > 80000:
            raise serializers.ValidationError("metadata is too large.")
        return {
            "schema_version": 1,
            "document_standard": "mathsphere.computational_notebook",
            **value,
        }

    def validate(self, attrs):
        if self.instance and self.instance.is_locked and self.context["request"].method in {"PUT", "PATCH"}:
            raise serializers.ValidationError({"is_locked": "Locked notebook cannot be modified."})
        return attrs


class NotebookSnapshotSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    document_id = serializers.UUIDField(source="document.public_id", read_only=True)

    class Meta:
        model = NotebookSnapshot
        fields = [
            "id",
            "document_id",
            "label",
            "source",
            "blocks",
            "metadata",
            "revision",
            "is_named",
            "created_at",
        ]
        read_only_fields = ["id", "document_id", "revision", "created_at"]

    def validate_blocks(self, value):
        return validate_block_payload(value)


class NotebookExecutionRecordSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    document_id = serializers.UUIDField(source="document.public_id", read_only=True)

    class Meta:
        model = NotebookExecutionRecord
        fields = [
            "id",
            "document_id",
            "block_id",
            "block_kind",
            "title",
            "status",
            "runtime",
            "cache_key",
            "detail",
            "inputs",
            "output",
            "duration_ms",
            "created_at",
        ]
        read_only_fields = ["id", "document_id", "created_at"]

    def validate_block_kind(self, value):
        if value not in ALLOWED_BLOCK_KINDS:
            raise serializers.ValidationError("Unsupported block kind.")
        return value


class NotebookExecutionJobSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    document_id = serializers.UUIDField(source="document.public_id", read_only=True)
    submitted_by = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = NotebookExecutionJob
        fields = [
            "id",
            "document_id",
            "submitted_by",
            "block_id",
            "block_kind",
            "title",
            "status",
            "runtime",
            "cache_key",
            "detail",
            "inputs",
            "output",
            "duration_ms",
            "timeout_seconds",
            "started_at",
            "finished_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_submitted_by(self, obj):
        if not obj.submitted_by_id:
            return None
        return {
            "id": obj.submitted_by_id,
            "username": obj.submitted_by.get_username(),
        }


class NotebookImportRecordSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    document_id = serializers.UUIDField(source="document.public_id", read_only=True)

    class Meta:
        model = NotebookImportRecord
        fields = [
            "id",
            "document_id",
            "source",
            "external_id",
            "title",
            "payload",
            "metadata",
            "created_at",
        ]
        read_only_fields = ["id", "document_id", "created_at"]


class NotebookExecuteSerializer(serializers.Serializer):
    document_id = serializers.UUIDField(required=False)
    block_id = serializers.CharField(max_length=160)
    kind = serializers.ChoiceField(choices=sorted(ALLOWED_BLOCK_KINDS))
    title = serializers.CharField(max_length=180, required=False, allow_blank=True)
    content = serializers.CharField()
    config = serializers.DictField(required=False, child=serializers.CharField(allow_blank=True))
    execution_target = serializers.ChoiceField(choices=["this-device", "local-python", "jupyter-kernel", "external-server", "hpc-cluster"], required=False)
    scientific_object_reference = serializers.DictField(required=False)

    def validate_scientific_object_reference(self, value):
        if not value.get("projectId") or not isinstance(value.get("projectId"), str):
            raise serializers.ValidationError("reference projectId is required.")
        if not value.get("objectId") or not isinstance(value.get("objectId"), str):
            raise serializers.ValidationError("reference objectId is required.")
        if value.get("mode") not in {"live", "pinned", "frozen"}:
            raise serializers.ValidationError("reference mode is invalid.")
        if "revision" in value and (not isinstance(value["revision"], int) or value["revision"] < 1):
            raise serializers.ValidationError("reference revision is invalid.")
        return value


class NotebookRestoreSnapshotSerializer(serializers.Serializer):
    snapshot_id = serializers.UUIDField()


class NotebookCapabilitySerializer(serializers.Serializer):
    kind = serializers.CharField()
    family = serializers.CharField()
    title = serializers.CharField()
    runtime = serializers.CharField()
    supports_preview = serializers.BooleanField()
    supports_execute = serializers.BooleanField()
    supports_export = serializers.BooleanField()


class CurrentUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    is_authenticated = serializers.BooleanField()
