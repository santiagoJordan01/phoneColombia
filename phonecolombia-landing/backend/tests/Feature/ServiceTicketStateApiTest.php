<?php

namespace Tests\Feature;

use App\Models\ServiceTicketState;
use App\Models\User;
use App\Support\ServiceTicketStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ServiceTicketStateApiTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFor(string $role): string
    {
        $user = User::factory()->create([
            'password' => Hash::make('password'),
            'role' => $role,
            'is_admin' => $role === User::ROLE_SUPER_ADMIN,
        ]);

        return $user->createToken('test')->plainTextToken;
    }

    public function test_lists_seeded_states(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($token)
            ->getJson('/api/service/states')
            ->assertOk()
            ->assertJsonFragment(['slug' => ServiceTicketStatus::PROCESO_REVISION])
            ->assertJsonFragment(['slug' => ServiceTicketStatus::SERVICIO_REALIZADO]);
    }

    public function test_can_create_custom_state(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($token)
            ->postJson('/api/service/states', [
                'name' => 'En garantía',
                'slug' => 'en_garantia',
                'sort_order' => 10,
                'marks_in_service' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'En garantía')
            ->assertJsonPath('slug', 'en_garantia');

        $this->assertDatabaseHas('service_ticket_states', [
            'slug' => 'en_garantia',
            'marks_in_service' => true,
        ]);
    }

    public function test_workshops_meta_uses_database_states(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        ServiceTicketState::create([
            'name' => 'Prueba custom',
            'slug' => 'prueba_custom',
            'sort_order' => 99,
            'is_active' => true,
        ]);

        $response = $this->withToken($token)->getJson('/api/service-tickets/workshops');

        $response->assertOk()
            ->assertJsonPath('statuses.prueba_custom', 'Prueba custom');
    }
}
