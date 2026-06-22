<?php

namespace CMS;

use League\CommonMark\Extension\FrontMatter\Data\FrontMatterDataParserInterface;
use League\CommonMark\Extension\FrontMatter\Exception\InvalidFrontMatterException;
use Symfony\Component\Yaml\Exception\ParseException;
use Symfony\Component\Yaml\Yaml;

class PermissiveFrontMatterDataParser implements FrontMatterDataParserInterface
{
    public function parse(string $frontMatter)
    {
        if (function_exists('ecms_normalize_text_encoding')) {
            $frontMatter = \ecms_normalize_text_encoding($frontMatter);
        }

        try {
            return Yaml::parse($frontMatter);
        } catch (ParseException $ex) {
            if (self::isMalformedInlineYamlStringException($ex)) {
                return self::parseWithSmartQuoteDelimiterRecovery($frontMatter);
            }

            if (!self::isDuplicateKeyException($ex)) {
                throw InvalidFrontMatterException::wrap($ex);
            }

            $dedupedFrontMatter = self::removeEarlierDuplicateKeys($frontMatter);
            try {
                return Yaml::parse($dedupedFrontMatter);
            } catch (ParseException $retryEx) {
                if (self::isMalformedInlineYamlStringException($retryEx)) {
                    return self::parseWithSmartQuoteDelimiterRecovery($dedupedFrontMatter);
                }

                throw InvalidFrontMatterException::wrap($retryEx);
            }
        }
    }

    private static function isDuplicateKeyException(ParseException $ex): bool
    {
        return str_contains($ex->getMessage(), 'Duplicate key');
    }

    private static function isMalformedInlineYamlStringException(ParseException $ex): bool
    {
        return str_contains($ex->getMessage(), 'Malformed inline YAML string');
    }

    private static function parseWithSmartQuoteDelimiterRecovery(string $frontMatter)
    {
        try {
            return Yaml::parse(self::normalizeMismatchedSmartQuoteDelimiters($frontMatter));
        } catch (ParseException $ex) {
            throw InvalidFrontMatterException::wrap($ex);
        }
    }

    private static function normalizeMismatchedSmartQuoteDelimiters(string $yaml): string
    {
        $lines = preg_split('/\R/u', $yaml);
        if ($lines === false) {
            return $yaml;
        }

        foreach ($lines as &$line) {
            $line = self::normalizeMismatchedSmartQuoteDelimiterLine($line);
        }
        unset($line);

        return implode("\n", $lines);
    }

    private static function normalizeMismatchedSmartQuoteDelimiterLine(string $line): string
    {
        return preg_replace(
            '/^(\s*[^:\s][^:]*:\s*)"(.*)([\x{201C}\x{201D}])(\s*(?:#.*)?)$/u',
            '$1"$2"$4',
            $line
        ) ?? $line;
    }

    private static function removeEarlierDuplicateKeys(string $yaml): string
    {
        $lines = preg_split('/\R/u', $yaml);
        if ($lines === false) {
            return $yaml;
        }

        $entries = [];
        $parents = [];

        foreach ($lines as $index => $line) {
            if (trim($line) === '' || preg_match('/^\s*#/', $line)) {
                continue;
            }

            $indent = self::indentWidth($line);
            while ($parents !== [] && $parents[array_key_last($parents)]['indent'] >= $indent) {
                array_pop($parents);
            }

            $key = self::mappingKey($line);
            if ($key === null) {
                continue;
            }

            $scope = implode("\0", array_column($parents, 'key'));
            $entryIndex = count($entries);
            $entries[] = [
                'line' => $index,
                'indent' => $indent,
                'key' => $key,
                'scope' => $scope,
            ];

            if (self::startsNestedBlock($line)) {
                $parents[] = [
                    'indent' => $indent,
                    'key' => $scope . "\0" . $key . "\0" . $entryIndex,
                ];
            }
        }

        $latest = [];
        $remove = array_fill(0, count($lines), false);

        foreach ($entries as $entryIndex => $entry) {
            $identity = $entry['scope'] . "\0" . $entry['indent'] . "\0" . $entry['key'];
            if (isset($latest[$identity])) {
                self::markEntryForRemoval($lines, $entries[$latest[$identity]], $remove);
            }
            $latest[$identity] = $entryIndex;
        }

        $kept = [];
        foreach ($lines as $index => $line) {
            if (!$remove[$index]) {
                $kept[] = $line;
            }
        }

        return implode("\n", $kept);
    }

    private static function indentWidth(string $line): int
    {
        return strlen($line) - strlen(ltrim($line, ' '));
    }

    private static function mappingKey(string $line): ?string
    {
        if (!preg_match('/^\s*([^:\s][^:]*):(?:\s|$)/', $line, $matches)) {
            return null;
        }

        return trim($matches[1], " \t'\"");
    }

    private static function startsNestedBlock(string $line): bool
    {
        return (bool) preg_match('/^\s*[^:\s][^:]*:\s*(?:#.*)?$/', $line);
    }

    private static function markEntryForRemoval(array $lines, array $entry, array &$remove): void
    {
        $start = $entry['line'];
        $indent = $entry['indent'];
        $remove[$start] = true;

        for ($index = $start + 1, $count = count($lines); $index < $count; $index++) {
            $line = $lines[$index];
            if (trim($line) === '') {
                $remove[$index] = true;
                continue;
            }

            if (self::indentWidth($line) <= $indent) {
                break;
            }

            $remove[$index] = true;
        }
    }
}
