<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCanViewReports
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->canViewReports()) {
            return response()->json(['message' => 'No tienes permiso para ver informes.'], 403);
        }

        return $next($request);
    }
}
