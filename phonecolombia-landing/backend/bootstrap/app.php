<?php

use App\Http\Middleware\EnsureCanAccessServiceTickets;
use App\Http\Middleware\EnsureCanAccessContent;
use App\Http\Middleware\EnsureCanAccessInventory;
use App\Http\Middleware\EnsureCanManageSales;
use App\Http\Middleware\EnsureCanViewReports;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
            'super_admin' => EnsureSuperAdmin::class,
            'content' => EnsureCanAccessContent::class,
            'inventory' => EnsureCanAccessInventory::class,
            'sales' => EnsureCanManageSales::class,
            'reports' => EnsureCanViewReports::class,
            'service_tickets' => EnsureCanAccessServiceTickets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
