FROM php:8.3-cli

# Install system dependencies and PHP extensions
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    && docker-php-ext-install pdo pdo_mysql zip

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy composer files first to cache dependencies
COPY composer.json composer.lock* ./
RUN composer update --no-scripts --no-autoloader

# Copy application source
COPY . .

# Generate optimized autoloader
RUN composer dump-autoload --optimize

EXPOSE 8000

# Start php development server on 0.0.0.0 so it is reachable from host and frontend container
CMD ["php", "-S", "0.0.0.0:8000", "-t", "public"]
