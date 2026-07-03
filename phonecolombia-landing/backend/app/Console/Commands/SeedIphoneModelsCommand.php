<?php

namespace App\Console\Commands;

use App\Support\IphoneModelCatalog;
use Illuminate\Console\Command;

class SeedIphoneModelsCommand extends Command
{
    protected $signature = 'inventory:seed-iphone-models';

    protected $description = 'Agrega al catálogo todos los modelos iPhone que aún no existan';

    public function handle(): int
    {
        $created = IphoneModelCatalog::seedMissing();
        $total = count(IphoneModelCatalog::models());

        $this->info("Catálogo iPhone: {$created} modelo(s) nuevo(s). Total definidos: {$total}.");

        return self::SUCCESS;
    }
}
