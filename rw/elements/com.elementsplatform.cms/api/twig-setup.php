<?php

/**
 * Twig Template Engine Setup
 *
 * Provides renderTemplate() for rendering Twig string templates.
 * Used by Collection and Load More components for server-side rendering.
 */

use Twig\Environment;
use Twig\Loader\ArrayLoader;
use Twig\TwigFilter;
use Twig\TwigFunction;

/**
 * Get or create the Twig environment singleton.
 */
function getTwigEnvironment(): Environment
{
    if (!isset($GLOBALS['_twig_environment'])) {
        $loader = new ArrayLoader();
        $twig = new Environment($loader, [
            'cache' => false,
            'debug' => false,
            'strict_variables' => false,
            'autoescape' => false,
        ]);

        // Load intl extension if available
        if (extension_loaded('intl') && class_exists('Twig\Extra\Intl\IntlExtension')) {
            $twig->addExtension(new \Twig\Extra\Intl\IntlExtension());
        }

        // Custom truncate filter
        $twig->addFilter(new TwigFilter('truncate', function (string $string, int $length = 100, string $ellipsis = '…'): string {
            if (mb_strlen($string) <= $length) {
                return $string;
            }
            return mb_substr($string, 0, $length) . $ellipsis;
        }));

        $GLOBALS['_twig_environment'] = $twig;
    }

    return $GLOBALS['_twig_environment'];
}

/**
 * Render a Twig string template with the given variables.
 */
function renderTemplate(string $template, array $variables = []): string
{
    $twig = getTwigEnvironment();

    // Use a unique template name for each template string
    $name = 'template_' . md5($template);
    $loader = $twig->getLoader();

    if ($loader instanceof ArrayLoader) {
        $loader->setTemplate($name, $template);
    }

    try {
        return $twig->render($name, $variables);
    } catch (\Exception $e) {
        error_log('CMS Template Error: ' . $e->getMessage());
        return '';
    }
}

/**
 * Add a custom Twig filter.
 */
function addTwigFilter(string $name, callable $callable, array $options = []): void
{
    getTwigEnvironment()->addFilter(new TwigFilter($name, $callable, $options));
}

/**
 * Add a custom Twig function.
 */
function addTwigFunction(string $name, callable $callable, array $options = []): void
{
    getTwigEnvironment()->addFunction(new TwigFunction($name, $callable, $options));
}

// Auto-initialize
getTwigEnvironment();
