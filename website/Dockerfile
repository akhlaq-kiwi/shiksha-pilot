FROM php:8.1-apache

# .htaccess relies on these; php:apache ships them disabled by default.
RUN a2enmod rewrite headers deflate expires

# The stock vhost has AllowOverride None, which silently ignores .htaccess —
# without this, none of the rewrite/security/caching rules in .htaccess apply.
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

WORKDIR /var/www/html
