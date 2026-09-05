<?php

namespace SwissDidata\Smpl;

use Didata\Packages\installer\Package;
use Didata\Packages\installer\PackageInstaller;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class SmplPackage extends PackageInstaller
{
    public function configure(Package $package): void
    {
        $package->hasNoConfigFile()
            ->hasNoTranslations()
            ->hasModulePlugin([
                'name'      => 'SMPL',
                'meta_data' => ['module_name' => 'smpl'],
                'icon'      => ['code' => 'biotech', 'color' => '#0072CE'],
                'template'  => __DIR__.'/../resources/template.xml',
                'js'        => __DIR__.'/../resources/script.js',
            ])
            ->hasModulePlugin([
                'name'      => 'SMPL Config',
                'meta_data' => ['module_name' => 'smpl_config'],
                'icon'      => ['code' => 'settings', 'color' => '#0072CE'],
                'template'  => __DIR__.'/../resources/config-template.xml',
                'js'        => __DIR__.'/../resources/config-script.js',
            ]);
    }

    private const SYNC_VERSION = '2.3.5';

    public function afterBoot(): void
    {
        $this->autoSync();
    }

    private function autoSync(): void
    {
        $hash     = self::SYNC_VERSION.'_'.md5_file(__DIR__.'/../resources/script.js');
        $flagFile = storage_path('app/smpl_synced_'.$hash);

        if (file_exists($flagFile)) {
            return;
        }

        app()->booted(function () use ($flagFile) {
            try {
                // Run package migrations directly in PHP — avoids Artisan::call('migrate')
                // which re-bootstraps a console kernel and can cause circular provider errors.
                $this->runPackageMigrations();
                Artisan::call('marketplace:sync-contributions');
                touch($flagFile);
            } catch (\Throwable $e) {
                // Retry on the next request — do not create the flag file.
            }
        });
    }

    private function runPackageMigrations(): void
    {
        $path  = __DIR__.'/../database/migrations';
        $ran   = DB::table('migrations')->pluck('migration')->all();
        $batch = (DB::table('migrations')->max('batch') ?? 0) + 1;

        foreach (glob($path.'/*.php') as $file) {
            $name = basename($file, '.php');
            if (in_array($name, $ran, true)) {
                continue;
            }
            $migration = require $file;
            $migration->up();
            DB::table('migrations')->insert(['migration' => $name, 'batch' => $batch]);
        }
    }
}
