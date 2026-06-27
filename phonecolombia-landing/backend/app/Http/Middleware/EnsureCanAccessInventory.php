<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCanAccessInventory
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->canAccessInventory()) {
            return response()->json(['message' => 'No tienes permiso para acceder al inventario.'], 403);
        }

        return $next($request);
    }
}
