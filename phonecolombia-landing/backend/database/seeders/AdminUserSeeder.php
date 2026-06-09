<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $admins = [
            ['email' => 'admin@phonecolombia.com', 'name' => 'Administrador'],
            ['email' => 'admin@gmail.com', 'name' => 'Admin Gmail'],
        ];

        foreach ($admins as $admin) {
            User::updateOrCreate(
                ['email' => $admin['email']],
                [
                    'name' => $admin['name'],
                    'password' => Hash::make('admin123'),
                    'is_admin' => true,
                ]
            );
        }
    }
}
