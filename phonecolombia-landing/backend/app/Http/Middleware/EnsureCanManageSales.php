<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCanManageSales
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->canManageSales()) {
            return response()->json(['message' => 'No tienes permiso para gestionar ventas.'], 403);
        }

        return $next($request);
    }
}
