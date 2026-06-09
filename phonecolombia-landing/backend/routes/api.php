<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DeviceColorController;
use App\Http\Controllers\Api\InventoryItemController;
use App\Http\Controllers\Api\InventoryProductController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PromocionController;
use App\Http\Controllers\Api\SiteSettingController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\TestimonioController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::get('/products', [ProductController::class, 'index']);
Route::get('/promociones', [PromocionController::class, 'index']);
Route::get('/testimonios', [TestimonioController::class, 'index']);
Route::get('/settings/{key}', [SiteSettingController::class, 'show']);

Route::middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::post('/products', [ProductController::class, 'store']);
    Route::match(['put', 'post'], '/products/{product}', [ProductController::class, 'update']);
    Route::delete('/products/{product}', [ProductController::class, 'destroy']);

    Route::post('/promociones', [PromocionController::class, 'store']);
    Route::delete('/promociones/{promocion}', [PromocionController::class, 'destroy']);

    Route::post('/testimonios', [TestimonioController::class, 'store']);
    Route::match(['put', 'post'], '/testimonios/{testimonio}', [TestimonioController::class, 'update']);
    Route::delete('/testimonios/{testimonio}', [TestimonioController::class, 'destroy']);

    Route::match(['put', 'post'], '/settings/{key}', [SiteSettingController::class, 'upsert']);

    Route::get('/device-colors', [DeviceColorController::class, 'index']);
    Route::post('/device-colors', [DeviceColorController::class, 'store']);
    Route::delete('/device-colors/{deviceColor}', [DeviceColorController::class, 'destroy']);

    Route::get('/suppliers', [SupplierController::class, 'index']);
    Route::post('/suppliers', [SupplierController::class, 'store']);
    Route::delete('/suppliers/{supplier}', [SupplierController::class, 'destroy']);

    Route::get('/inventory/products', [InventoryProductController::class, 'index']);
    Route::post('/inventory/products', [InventoryProductController::class, 'store']);
    Route::match(['put', 'post'], '/inventory/products/{inventoryProduct}', [InventoryProductController::class, 'update']);
    Route::delete('/inventory/products/{inventoryProduct}', [InventoryProductController::class, 'destroy']);

    Route::get('/inventory', [InventoryItemController::class, 'index']);
    Route::post('/inventory', [InventoryItemController::class, 'store']);
    Route::match(['put', 'post'], '/inventory/{inventoryItem}', [InventoryItemController::class, 'update']);
    Route::delete('/inventory/{inventoryItem}', [InventoryItemController::class, 'destroy']);
});
