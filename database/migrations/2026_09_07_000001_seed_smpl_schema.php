<?php

use Illuminate\Database\Migrations\Migration;
use SwissDidata\Smpl\SmplSchemaSeeder;

return new class extends Migration
{
    public function up(): void
    {
        (new SmplSchemaSeeder())->seed();
    }

    public function down(): void
    {
        // Entity types and fields are not dropped on rollback to avoid data loss.
    }
};
