<?php

namespace App\Bootstrap;

use DI\ContainerBuilder;
use Psr\Container\ContainerInterface;
use PDO;

class Container
{
    public static function build(): ContainerInterface
    {
        $containerBuilder = new ContainerBuilder();

        // Enable PHP-DI autowiring
        $containerBuilder->useAutowiring(true);

        $containerBuilder->addDefinitions([
            PDO::class => function () {
                $host = getenv('DB_HOST') ?: '127.0.0.1';
                $user = getenv('DB_USER') ?: 'root';
                $pass = getenv('DB_PASS') ?: 'admin123';
                $name = getenv('DB_NAME') ?: 'bn_school_sp';

                // Initial connection to mysql server
                $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass);
                $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

                // Auto create database if not exists
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $pdo->exec("USE `$name`");

                return $pdo;
            },
        ]);

        return $containerBuilder->build();
    }
}
