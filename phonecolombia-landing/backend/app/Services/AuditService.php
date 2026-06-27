<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class AuditService
{
    public function log(
        Model $model,
        string $action,
        ?string $field = null,
        mixed $oldValue = null,
        mixed $newValue = null,
        ?array $meta = null,
        ?User $user = null,
    ): AuditLog {
        $user = $user ?? auth()->user();

        return AuditLog::create([
            'user_id' => $user?->id,
            'auditable_type' => $model::class,
            'auditable_id' => (string) $model->getKey(),
            'action' => $action,
            'field' => $field,
            'old_value' => $this->stringify($oldValue),
            'new_value' => $this->stringify($newValue),
            'meta' => $meta,
        ]);
    }

    public function logChanges(Model $model, array $original, array $changes, ?User $user = null): void
    {
        foreach ($changes as $field => $newValue) {
            $oldValue = $original[$field] ?? null;
            if ((string) $oldValue === (string) $newValue) {
                continue;
            }
            $this->log($model, 'updated', $field, $oldValue, $newValue, null, $user);
        }
    }

    public function logSystem(string $action, ?array $meta = null, ?User $user = null): AuditLog
    {
        $user = $user ?? auth()->user();

        return AuditLog::create([
            'user_id' => $user?->id,
            'auditable_type' => 'system',
            'auditable_id' => '0',
            'action' => $action,
            'field' => null,
            'old_value' => null,
            'new_value' => null,
            'meta' => $meta,
        ]);
    }

    private function stringify(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        if (is_string($value) || is_numeric($value)) {
            return (string) $value;
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE);
    }
}
