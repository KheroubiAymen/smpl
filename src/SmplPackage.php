<?php

namespace SwissDidata\Smpl;

use Didata\Packages\installer\Package;
use Didata\Packages\installer\PackageInstaller;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;

class SmplPackage extends PackageInstaller
{
    private const ASSETS = [
        'd3.min.js'          => 'application/javascript',
        'batch.svg'          => 'image/svg+xml',
        'person.svg'         => 'image/svg+xml',
        'branches_hide.png'  => 'image/png',
        'branches_show.png'  => 'image/png',
        'SMPL_logo_2.png'    => 'image/png',
        'LOGO_SBP.svg'       => 'image/svg+xml',
    ];

    public function configure(Package $package): void
    {
        $package->hasNoConfigFile()
            ->hasNoRoutes()
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

    public function afterBoot(): void
    {
        $publicDir = __DIR__.'/../resources/public';

        // Route publique pour servir les assets directement depuis le package.
        // Fonctionne immédiatement après install sans copie de fichiers.
        Route::get('vendor/smpl/{file}', function (string $file) use ($publicDir) {
            $mime = self::ASSETS[$file] ?? null;
            abort_unless($mime !== null, 404);
            return response()->file($publicDir.'/'.$file, ['Content-Type' => $mime]);
        });

        // En parallèle, copie dans public/vendor/smpl/ pour que nginx serve
        // les fichiers directement (plus rapide) sans passer par PHP.
        $target = public_path('vendor/smpl');
        if (! is_dir($target)) {
            File::ensureDirectoryExists($target);
            File::copyDirectory($publicDir, $target);
        }
    }
}
