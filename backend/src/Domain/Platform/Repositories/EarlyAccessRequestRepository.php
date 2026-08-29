<?php

declare(strict_types=1);

namespace App\Domain\Platform\Repositories;

use App\Shared\BaseRepository;

/**
 * Early-access sign-ups for the Android app, submitted from the public
 * marketing site (website/mobile-app.php) straight into this same database —
 * no API call, no queue, the same shared-table arrangement as website_leads.
 *
 * Rows are a worklist: Play internal testing has no self-serve join, so each
 * PENDING row is somebody waiting on a human to add their Google account to
 * the tester list in the Play Console.
 */
class EarlyAccessRequestRepository extends BaseRepository
{
    protected string $table = 'early_access_requests';
}
