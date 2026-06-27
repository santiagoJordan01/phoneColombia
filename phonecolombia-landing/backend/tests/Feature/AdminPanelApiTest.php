<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Promocion;
use App\Models\SiteSetting;
use App\Models\Testimonio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminPanelApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->admin = User::factory()->create([
            'email' => 'admin@phonecolombia.com',
            'password' => Hash::make('admin123'),
            'is_admin' => true,
            'role' => User::ROLE_SUPER_ADMIN,
        ]);
    }

    private function adminToken(): string
    {
        return $this->admin->createToken('admin-panel')->plainTextToken;
    }

    public function test_admin_can_login_and_access_protected_routes(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@phonecolombia.com',
            'password' => 'admin123',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);

        $token = $response->json('token');

        $this->withToken($token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJson(['email' => 'admin@phonecolombia.com', 'is_admin' => true]);
    }

    public function test_content_role_cannot_login_or_manage_products(): void
    {
        $contentUser = User::factory()->create([
            'email' => 'content@test.com',
            'password' => Hash::make('secret'),
            'role' => User::ROLE_CONTENT,
            'is_admin' => false,
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'content@test.com',
            'password' => 'secret',
        ])->assertForbidden();

        $token = $contentUser->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->post('/api/products', [
                'name' => 'Bloqueado',
                'price' => '1',
                'description' => 'Test',
            ])
            ->assertForbidden();
    }

    public function test_non_admin_cannot_login(): void
    {
        User::factory()->create([
            'email' => 'user@test.com',
            'password' => Hash::make('secret'),
            'is_admin' => false,
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'user@test.com',
            'password' => 'secret',
        ])->assertForbidden();
    }

    public function test_admin_can_manage_products(): void
    {
        $token = $this->adminToken();
        $image = UploadedFile::fake()->image('iphone.jpg');

        $create = $this->withToken($token)->post('/api/products', [
            'name' => 'iPhone 15',
            'price' => '3.500.000',
            'description' => 'Nuevo',
            'images' => [$image],
        ]);

        $create->assertCreated();
        $productId = $create->json('id');

        $this->assertDatabaseHas('products', [
            'id' => $productId,
            'name' => 'iPhone 15',
        ]);

        $this->withToken($token)->put("/api/products/{$productId}", [
            'name' => 'iPhone 15 Pro',
            'price' => '4.000.000',
            'description' => 'Actualizado',
        ])->assertOk()
            ->assertJsonPath('name', 'iPhone 15 Pro');

        $this->withToken($token)->delete("/api/products/{$productId}")
            ->assertOk();

        $this->assertDatabaseMissing('products', ['id' => $productId]);
    }

    public function test_admin_can_manage_promociones(): void
    {
        $token = $this->adminToken();

        $create = $this->withToken($token)->post('/api/promociones', [
            'nombre' => 'SUPER PROMO',
            'precio' => '1.000.000',
            'bundle' => 'CASE + CARGADOR',
            'alt' => 'Promo test',
            'imagen' => UploadedFile::fake()->image('promo.jpg'),
        ]);

        $create->assertCreated();
        $id = $create->json('id');

        $this->assertDatabaseHas('promociones', ['id' => $id, 'nombre' => 'SUPER PROMO']);

        $this->withToken($token)->delete("/api/promociones/{$id}")->assertOk();
        $this->assertDatabaseMissing('promociones', ['id' => $id]);
    }

    public function test_admin_can_manage_testimonios(): void
    {
        $token = $this->adminToken();

        $create = $this->withToken($token)->post('/api/testimonios', [
            'caption' => 'Cliente feliz',
            'video' => UploadedFile::fake()->create('testimonio.mp4', 100, 'video/mp4'),
        ]);

        $create->assertCreated();
        $id = $create->json('id');

        $this->withToken($token)->put("/api/testimonios/{$id}", [
            'caption' => 'Actualizado',
        ])->assertOk()
            ->assertJsonPath('caption', 'Actualizado');

        $this->withToken($token)->delete("/api/testimonios/{$id}")->assertOk();
        $this->assertDatabaseMissing('testimonios', ['id' => $id]);
    }

    public function test_admin_can_manage_site_settings(): void
    {
        $token = $this->adminToken();

        $garantias = [
            ['title' => 'Celulares', 'text1' => 'Garantía legal', 'text2' => 'Sin golpes'],
        ];

        $this->withToken($token)->putJson('/api/settings/garantias', [
            'value' => $garantias,
        ])->assertOk();

        $this->getJson('/api/settings/garantias')
            ->assertOk()
            ->assertJsonPath('key', 'garantias');

        $this->withToken($token)->post('/api/settings/hero_video_url', [
            'video' => UploadedFile::fake()->create('hero.mp4', 200, 'video/mp4'),
        ])->assertOk()
            ->assertJsonPath('key', 'hero_video_url');

        $this->assertDatabaseHas('site_settings', ['key' => 'garantias']);
        $this->assertDatabaseHas('site_settings', ['key' => 'hero_video_url']);
    }

    public function test_public_routes_are_accessible_without_token(): void
    {
        Product::create([
            'name' => 'iPad',
            'price' => '2.000.000',
            'description' => 'Tablet',
            'images' => ['http://example.com/ipad.jpg'],
        ]);

        Promocion::create([
            'nombre' => 'Promo',
            'precio' => '999',
            'bundle' => 'Kit',
            'imagen_url' => 'http://example.com/promo.jpg',
        ]);

        Testimonio::create([
            'video_url' => 'http://example.com/video.mp4',
            'caption' => 'Test',
        ]);

        SiteSetting::create([
            'key' => 'garantias',
            'value' => '[]',
            'updated_at' => now(),
        ]);

        $this->getJson('/api/products')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/promociones')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/testimonios')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/settings/garantias')->assertOk();
    }

    public function test_protected_routes_reject_guests(): void
    {
        $this->postJson('/api/products', ['name' => 'Test'])->assertUnauthorized();
        $this->postJson('/api/promociones')->assertUnauthorized();
        $this->postJson('/api/testimonios')->assertUnauthorized();
        $this->putJson('/api/settings/garantias', ['value' => []])->assertUnauthorized();
    }
}
