<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class EnsureAdminUserCommand extends Command
{
    protected $signature = 'admin:ensure {email=admin@gmail.com} {--password=admin123}';

    protected $description = 'Crea o actualiza un usuario administrador';

    public function handle(): int
    {
        $email = (string) $this->argument('email');
        $password = (string) $this->option('password');

        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $email === 'admin@gmail.com' ? 'Admin Gmail' : 'Administrador',
                'password' => Hash::make($password),
                'is_admin' => true,
                'role' => User::ROLE_SUPER_ADMIN,
            ],
        );

        $this->info("Usuario listo: {$user->email} (contraseña: {$password})");

        return self::SUCCESS;
    }
}
