<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\ServiceTechnician;
use App\Models\ServiceTicket;
use App\Models\User;
use App\Support\InventoryStatus;
use App\Support\ServiceTicketStatus;
use App\Support\ServiceTicketType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserRolesTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFor(User $user): string
    {
        return $user->createToken('test')->plainTextToken;
    }

    private function userWithRole(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'password' => Hash::make('password'),
            'role' => $role,
            'is_admin' => $role === User::ROLE_SUPER_ADMIN,
        ], $overrides));
    }

    public function test_asesor_can_create_service_ticket_but_not_inventory_item(): void
    {
        $asesor = $this->userWithRole(User::ROLE_ASESOR);
        $token = $this->tokenFor($asesor);

        $this->withToken($token)
            ->postJson('/api/service-tickets', [
                'ticket_type' => ServiceTicketType::CLIENTE_EXTERNO,
                'device_name' => 'IPHONE 12',
                'issue_description' => 'PANTALLA',
                'customer_name' => 'Ana',
            ])
            ->assertCreated();

        $this->withToken($token)
            ->postJson('/api/inventory', [
                'name' => 'IPHONE 12',
                'imei' => '123456789012345',
                'sale_price' => '1000000',
                'status' => InventoryStatus::DISPONIBLE,
            ])
            ->assertForbidden();
    }

    public function test_service_technician_sees_only_assigned_tickets(): void
    {
        $catalogTech = ServiceTechnician::create([
            'name' => 'Técnico A',
            'workshop' => 'Taller A',
            'is_active' => true,
        ]);

        $techUser = $this->userWithRole(User::ROLE_SERVICE_TECHNICIAN, [
            'service_technician_id' => $catalogTech->id,
        ]);
        $otherUser = $this->userWithRole(User::ROLE_INVENTORY);

        $assigned = ServiceTicket::create([
            'ticket_type' => ServiceTicketType::CLIENTE_EXTERNO,
            'device_name' => 'Asignado',
            'issue_description' => 'Falla',
            'status' => ServiceTicketStatus::PROCESO_REVISION,
            'service_technician_id' => $catalogTech->id,
            'received_at' => now(),
        ]);

        ServiceTicket::create([
            'ticket_type' => ServiceTicketType::CLIENTE_EXTERNO,
            'device_name' => 'Otro',
            'issue_description' => 'Falla',
            'status' => ServiceTicketStatus::PROCESO_REVISION,
            'assigned_user_id' => $otherUser->id,
            'received_at' => now(),
        ]);

        $response = $this->withToken($this->tokenFor($techUser))
            ->getJson('/api/service-tickets');

        $response->assertOk();
        $ids = collect($response->json())->pluck('id');
        $this->assertTrue($ids->contains($assigned->id));
        $this->assertCount(1, $ids);
    }

    public function test_service_technician_cannot_update_even_assigned_ticket(): void
    {
        $catalogTech = ServiceTechnician::create([
            'name' => 'Técnico B',
            'workshop' => 'Taller B',
            'is_active' => true,
        ]);

        $techUser = $this->userWithRole(User::ROLE_SERVICE_TECHNICIAN, [
            'service_technician_id' => $catalogTech->id,
        ]);

        $ticket = ServiceTicket::create([
            'ticket_type' => ServiceTicketType::CLIENTE_EXTERNO,
            'device_name' => 'Equipo',
            'issue_description' => 'Original',
            'status' => ServiceTicketStatus::PROCESO_REVISION,
            'service_technician_id' => $catalogTech->id,
            'received_at' => now(),
        ]);

        $this->withToken($this->tokenFor($techUser))
            ->putJson("/api/service-tickets/{$ticket->id}", [
                'status' => ServiceTicketStatus::SERVICIO_TECNICO,
                'repair_notes' => 'Intento de edición',
            ])
            ->assertForbidden();

        $ticket->refresh();
        $this->assertSame(ServiceTicketStatus::PROCESO_REVISION, $ticket->status);
        $this->assertNull($ticket->repair_notes);
    }

    public function test_service_technician_cannot_create_or_edit_unassigned_ticket(): void
    {
        $techUser = $this->userWithRole(User::ROLE_SERVICE_TECHNICIAN, [
            'service_technician_id' => ServiceTechnician::create([
                'name' => 'Técnico C',
                'workshop' => 'Taller C',
                'is_active' => true,
            ])->id,
        ]);

        $this->withToken($this->tokenFor($techUser))
            ->postJson('/api/service-tickets', [
                'ticket_type' => ServiceTicketType::CLIENTE_EXTERNO,
                'device_name' => 'Nuevo',
                'issue_description' => 'Falla',
            ])
            ->assertForbidden();

        $foreign = ServiceTicket::create([
            'ticket_type' => ServiceTicketType::CLIENTE_EXTERNO,
            'device_name' => 'Ajeno',
            'issue_description' => 'Falla',
            'status' => ServiceTicketStatus::PROCESO_REVISION,
            'received_at' => now(),
        ]);

        $this->withToken($this->tokenFor($techUser))
            ->putJson("/api/service-tickets/{$foreign->id}", [
                'status' => ServiceTicketStatus::SERVICIO_REALIZADO,
            ])
            ->assertForbidden();
    }

    public function test_service_technician_cannot_access_inventory_bootstrap(): void
    {
        $techUser = $this->userWithRole(User::ROLE_SERVICE_TECHNICIAN, [
            'service_technician_id' => ServiceTechnician::create([
                'name' => 'Técnico D',
                'is_active' => true,
            ])->id,
        ]);

        $this->withToken($this->tokenFor($techUser))
            ->getJson('/api/bootstrap/inventory')
            ->assertForbidden();

        $this->withToken($this->tokenFor($techUser))
            ->getJson('/api/bootstrap/service-tickets')
            ->assertOk();
    }
}
