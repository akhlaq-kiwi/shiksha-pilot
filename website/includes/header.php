<?php
/** Nav partial. Expects $pagePath to be set by the including page. */
$navPages = site_pages();
?>
<a class="skip-link" href="#main">Skip to main content</a>
<nav class="nav" aria-label="Primary">
  <div class="wrap">
    <a class="logo" href="<?php echo PAGE_BASE; ?>/">
      <img class="logo-icon" src="<?php echo ASSET_BASE; ?>/images/logo-icon.png" width="44" height="37" alt="<?php echo SITE_NAME; ?>">
      <span class="logo-word"><?php echo SITE_NAME; ?></span>
    </a>
    <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="navLinks" aria-label="Open menu">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="#26333f" stroke-width="2.2" stroke-linecap="round"/></svg>
    </button>
    <div class="nav-links" id="navLinks">
      <a href="<?php echo PAGE_BASE; ?>/" <?php echo $pagePath === '/' ? 'aria-current="page"' : ''; ?>>Home</a>
      <a href="<?php echo PAGE_BASE; ?>/features" <?php echo $pagePath === '/features' ? 'aria-current="page"' : ''; ?>>Features</a>
      <a href="<?php echo PAGE_BASE; ?>/mobile-app" <?php echo $pagePath === '/mobile-app' ? 'aria-current="page"' : ''; ?>>Mobile App</a>
      <a href="<?php echo PAGE_BASE; ?>/schools" <?php echo (str_starts_with($pagePath, '/schools')) ? 'aria-current="page"' : ''; ?>>Explore Schools</a>
      <a class="btn btn-coral" href="<?php echo PAGE_BASE; ?>/contact">Book a demo</a>
    </div>
  </div>
</nav>
<main id="main">
