<?php

declare(strict_types=1);

namespace App\Domain\Platform\Repositories;

use App\Shared\BaseRepository;

/**
 * Demo requests submitted from the public marketing site (website/contact.php),
 * written directly into this same database — no API call, no queue, just a
 * shared table between the two codebases.
 */
class WebsiteLeadRepository extends BaseRepository
{
    protected string $table = 'website_leads';
}
