<?php

namespace App\Support;

use App\Models\ServiceCustomer;

class ServiceCustomerResolver
{
    /**
     * Normaliza nombre/teléfono del payload y vincula o crea un cliente de servicio.
     *
     * @param  array<string, mixed>  $data
     */
    public static function resolveIntoPayload(array &$data): void
    {
        if (! empty($data['service_customer_id'])) {
            $customer = ServiceCustomer::find($data['service_customer_id']);
            if ($customer) {
                $data['customer_name'] = $customer->name;
                $data['customer_phone'] = $customer->phone;
            }

            return;
        }

        $name = trim((string) ($data['customer_name'] ?? ''));
        $phone = trim((string) ($data['customer_phone'] ?? ''));

        if ($name === '' && $phone === '') {
            return;
        }

        $customer = ServiceCustomer::findOrCreateFromContact($name, $phone);
        if (! $customer) {
            return;
        }

        $data['service_customer_id'] = $customer->id;
        $data['customer_name'] = $customer->name;
        $data['customer_phone'] = $customer->phone;
    }
}
