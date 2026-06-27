<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\User;

class InventoryMovementService
{
    public function record(
        InventoryItem $item,
        string $type,
        ?string $field = null,
        mixed $oldValue = null,
        mixed $newValue = null,
        ?string $notes = null,
        ?array $meta = null,
        ?User $user = null,
    ): InventoryMovement {
        $user = $user ?? auth()->user();

        return InventoryMovement::create([
            'inventory_item_id' => $item->id,
            'user_id' => $user?->id,
            'type' => $type,
            'field' => $field,
            'old_value' => $this->stringify($oldValue),
            'new_value' => $this->stringify($newValue),
            'notes' => $notes,
            'meta' => $meta,
        ]);
    }

    public function recordItemChanges(InventoryItem $item, array $original, array $changes, ?User $user = null): void
    {
        foreach ($changes as $field => $newValue) {
            $oldValue = $original[$field] ?? null;
            if ((string) $oldValue === (string) $newValue) {
                continue;
            }
            $type = $field === 'status' ? 'status_change' : 'field_update';
            $this->record($item, $type, $field, $oldValue, $newValue, null, null, $user);
        }
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
