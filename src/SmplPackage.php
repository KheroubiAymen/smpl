<?php

namespace SwissDidata\Smpl;

use Didata\Packages\installer\Package;
use Didata\Packages\installer\PackageInstaller;

class SmplPackage extends PackageInstaller
{
    public function configure(Package $package): void
    {
        $package->hasNoConfigFile()
            ->hasNoRoutes();
    }
}
