<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('remission_number', 30)->nullable()->after('id');
        });

        $yearCounters = [];
        $sales = DB::table('sales')
            ->select('id', 'sold_at', 'reserved_at', 'created_at')
            ->orderByRaw('COALESCE(sold_at, reserved_at, created_at) ASC')
            ->orderBy('id')
            ->get();

        foreach ($sales as $sale) {
            $timestamp = $sale->sold_at ?? $sale->reserved_at ?? $sale->created_at;
            $year = $timestamp ? (int) date('Y', strtotime($timestamp)) : (int) date('Y');
            $yearCounters[$year] = ($yearCounters[$year] ?? 0) + 1;
            $number = sprintf('R-%d-%06d', $year, $yearCounters[$year]);

            DB::table('sales')->where('id', $sale->id)->update(['remission_number' => $number]);
        }

        Schema::table('sales', function (Blueprint $table) {
            $table->unique('remission_number');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropUnique(['remission_number']);
            $table->dropColumn('remission_number');
        });
    }
};
