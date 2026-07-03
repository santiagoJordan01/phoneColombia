<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /** @var list<string> */
    private array $defaults = [
        'IPHONE',
        'APPLE',
        'SAMSUNG',
        'XIAOMI',
        'REDMI',
        'POCO',
        'HUAWEI',
        'HONOR',
        'MOTOROLA',
        'OPPO',
        'REALME',
        'VIVO',
        'GOOGLE',
        'ONEPLUS',
        'TECNO',
        'INFINIX',
        'NOKIA',
        'SONY',
        'LG',
    ];

    public function up(): void
    {
        $now = now();

        foreach ($this->defaults as $name) {
            DB::table('device_brands')->insert([
                'id' => (string) Str::uuid(),
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('device_brands')->truncate();
    }
};
