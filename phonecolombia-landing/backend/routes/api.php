<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BootstrapController;
use App\Http\Controllers\Api\CreditConfigController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeviceColorController;
use App\Http\Controllers\Api\InventoryImportExportController;
use App\Http\Controllers\Api\InventoryItemController;
use App\Http\Controllers\Api\InventoryProductController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PromocionController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SaleReservationController;
use App\Http\Controllers\Api\ServiceCategoryController;
use App\Http\Controllers\Api\ServiceCustomerController;
use App\Http\Controllers\Api\ServiceTechnicianController;
use App\Http\Controllers\Api\ServiceTicketStateController;
use App\Http\Controllers\Api\ServiceTicketController;
use App\Http\Controllers\Api\SiteSettingController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\TestimonioController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::get('/products', [ProductController::class, 'index']);
Route::get('/promociones', [PromocionController::class, 'index']);
Route::get('/testimonios', [TestimonioController::class, 'index']);
Route::get('/settings/{key}', [SiteSettingController::class, 'show']);

Route::middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/bootstrap/dashboard', [BootstrapController::class, 'dashboard']);
    Route::get('/bootstrap/inventory', [BootstrapController::class, 'inventory']);
    Route::get('/bootstrap/sales', [BootstrapController::class, 'sales']);
    Route::get('/bootstrap/reports', [BootstrapController::class, 'reports']);

    Route::middleware('service_tickets')->group(function () {
        Route::get('/bootstrap/service-tickets', [BootstrapController::class, 'serviceTickets']);
        Route::get('/service-tickets/technicians', [ServiceTicketController::class, 'technicians']);
        Route::get('/service-tickets/workshops', [ServiceTicketController::class, 'workshops']);
        Route::get('/service-tickets', [ServiceTicketController::class, 'index']);
        Route::post('/service-tickets', [ServiceTicketController::class, 'store']);
        Route::match(['put', 'post'], '/service-tickets/{serviceTicket}', [ServiceTicketController::class, 'update']);
    });

    Route::middleware('content')->group(function () {
        Route::post('/products', [ProductController::class, 'store']);
        Route::match(['put', 'post'], '/products/{product}', [ProductController::class, 'update']);
        Route::delete('/products/{product}', [ProductController::class, 'destroy']);

        Route::post('/promociones', [PromocionController::class, 'store']);
        Route::delete('/promociones/{promocion}', [PromocionController::class, 'destroy']);

        Route::post('/testimonios', [TestimonioController::class, 'store']);
        Route::match(['put', 'post'], '/testimonios/{testimonio}', [TestimonioController::class, 'update']);
        Route::delete('/testimonios/{testimonio}', [TestimonioController::class, 'destroy']);

        Route::match(['put', 'post'], '/settings/{key}', [SiteSettingController::class, 'upsert']);
    });

    Route::middleware('inventory')->group(function () {
        Route::get('/device-colors', [DeviceColorController::class, 'index']);
        Route::post('/device-colors', [DeviceColorController::class, 'store']);
        Route::match(['put', 'post'], '/device-colors/{deviceColor}', [DeviceColorController::class, 'update']);
        Route::delete('/device-colors/{deviceColor}', [DeviceColorController::class, 'destroy']);

        Route::get('/suppliers', [SupplierController::class, 'index']);
        Route::post('/suppliers', [SupplierController::class, 'store']);
        Route::match(['put', 'post'], '/suppliers/{supplier}', [SupplierController::class, 'update']);
        Route::delete('/suppliers/{supplier}', [SupplierController::class, 'destroy']);

        Route::get('/inventory/products', [InventoryProductController::class, 'index']);
        Route::post('/inventory/products', [InventoryProductController::class, 'store']);
        Route::match(['put', 'post'], '/inventory/products/{inventoryProduct}', [InventoryProductController::class, 'update']);
        Route::delete('/inventory/products/{inventoryProduct}', [InventoryProductController::class, 'destroy']);

        Route::get('/dashboard', [DashboardController::class, 'index']);

        Route::get('/inventory/summary-by-model', [InventoryItemController::class, 'summaryByModel']);
        Route::get('/inventory/export', [ReportController::class, 'exportInventory']);
        Route::get('/inventory/import/template', [InventoryImportExportController::class, 'template']);
        Route::post('/inventory/import', [InventoryImportExportController::class, 'import']);
        Route::get('/inventory', [InventoryItemController::class, 'index']);
        Route::post('/inventory', [InventoryItemController::class, 'store']);
        Route::get('/inventory/{inventoryItem}', [InventoryItemController::class, 'show']);
        Route::match(['put', 'post'], '/inventory/{inventoryItem}', [InventoryItemController::class, 'update']);
        Route::delete('/inventory/{inventoryItem}', [InventoryItemController::class, 'destroy']);
        Route::post('/inventory/{inventoryItem}/retake', [InventoryItemController::class, 'retake']);
        Route::post('/inventory/{inventoryItem}/reserve', [SaleReservationController::class, 'reserve']);
        Route::post('/inventory/{inventoryItem}/cancel-reservation', [SaleReservationController::class, 'cancelByItem']);

        Route::get('/service/customers', [ServiceCustomerController::class, 'index']);
        Route::post('/service/customers', [ServiceCustomerController::class, 'store']);
        Route::match(['put', 'post'], '/service/customers/{serviceCustomer}', [ServiceCustomerController::class, 'update']);
        Route::delete('/service/customers/{serviceCustomer}', [ServiceCustomerController::class, 'destroy']);

        Route::get('/service/categories', [ServiceCategoryController::class, 'index']);
        Route::post('/service/categories', [ServiceCategoryController::class, 'store']);
        Route::match(['put', 'post'], '/service/categories/{serviceCategory}', [ServiceCategoryController::class, 'update']);
        Route::delete('/service/categories/{serviceCategory}', [ServiceCategoryController::class, 'destroy']);

        Route::get('/service/states', [ServiceTicketStateController::class, 'index']);
        Route::post('/service/states', [ServiceTicketStateController::class, 'store']);
        Route::match(['put', 'post'], '/service/states/{serviceTicketState}', [ServiceTicketStateController::class, 'update']);
        Route::delete('/service/states/{serviceTicketState}', [ServiceTicketStateController::class, 'destroy']);

        Route::get('/service/technicians', [ServiceTechnicianController::class, 'index']);
        Route::post('/service/technicians', [ServiceTechnicianController::class, 'store']);
        Route::match(['put', 'post'], '/service/technicians/{serviceTechnician}', [ServiceTechnicianController::class, 'update']);
        Route::delete('/service/technicians/{serviceTechnician}', [ServiceTechnicianController::class, 'destroy']);
    });

    Route::middleware('sales')->group(function () {
        Route::get('/sales', [SaleController::class, 'index']);
        Route::post('/sales', [SaleController::class, 'store']);
        Route::match(['put', 'patch'], '/sales/{sale}', [SaleController::class, 'update']);
        Route::post('/sales/{sale}/payments', [SaleController::class, 'addPayment']);
        Route::post('/sales/{sale}/complete-reservation', [SaleReservationController::class, 'complete']);
        Route::post('/sales/{sale}/cancel-reservation', [SaleReservationController::class, 'cancel']);
        Route::get('/credit-config', [CreditConfigController::class, 'index']);
    });

    Route::middleware('reports')->group(function () {
        Route::get('/sales/{sale}/remission', [SaleController::class, 'showRemission']);
        Route::get('/sales/{sale}/remission/pdf', [SaleController::class, 'exportRemissionPdf']);
        Route::get('/reports/daily', [ReportController::class, 'daily']);
        Route::get('/reports/daily/export/pdf', [ReportController::class, 'exportDailyPdf']);
        Route::get('/reports/daily/export/xlsx', [ReportController::class, 'exportDailyExcel']);
        Route::get('/reports/monthly', [ReportController::class, 'monthly']);
        Route::get('/reports/by-seller', [ReportController::class, 'bySeller']);
        Route::get('/reports/by-seller/export/pdf', [ReportController::class, 'exportBySellerPdf']);
        Route::get('/reports/by-seller/export/xlsx', [ReportController::class, 'exportBySellerExcel']);
        Route::get('/reports/by-remission', [ReportController::class, 'byRemission']);
        Route::get('/reports/cash-register', [ReportController::class, 'cashRegister']);
        Route::get('/reports/cash-register/export/pdf', [ReportController::class, 'exportCashRegisterPdf']);
        Route::get('/reports/cash-register/export/xlsx', [ReportController::class, 'exportCashRegisterExcel']);
        Route::get('/reports/receivables', [ReportController::class, 'receivables']);
        Route::get('/reports/receivables/export/pdf', [ReportController::class, 'exportReceivablesPdf']);
        Route::get('/reports/receivables/export/xlsx', [ReportController::class, 'exportReceivablesExcel']);
        Route::get('/reports/export/sales', [ReportController::class, 'exportSales']);
    });

    Route::middleware('super_admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::match(['put', 'post'], '/users/{user}', [UserController::class, 'update']);
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
        Route::post('/credit-config/methods', [CreditConfigController::class, 'storeMethod']);
        Route::match(['put', 'patch'], '/credit-config/methods/{creditPaymentMethod}', [CreditConfigController::class, 'updateMethod']);
        Route::delete('/credit-config/methods/{creditPaymentMethod}', [CreditConfigController::class, 'destroyMethod']);
        Route::match(['put', 'patch'], '/credit-config/settings', [CreditConfigController::class, 'updateSettings']);
    });
});
