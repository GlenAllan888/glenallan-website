<?php

// ---------------------------------------------------------------------------
// Writing assistant actions. Hardcoded in v1 — intentionally small so the
// registry stays easy to skim and model outputs stay predictable.
// ---------------------------------------------------------------------------
// Each action:
//   system:             system prompt
//   mode:               'replace' (overwrites the selection) or 'insert'
//                       (puts new text at the cursor)
//   requires_selection: whether the action is enabled with an empty cursor
//   params:             optional user-supplied params (target_lang, custom)

function ai_writing_actions(): array {
    return [
        'rewrite_professional' => [
            'label'              => 'Rewrite: Professional',
            'mode'               => 'replace',
            'requires_selection' => true,
            'system'             => 'Rewrite the user\'s text in a more professional tone while preserving meaning, structure, and markdown. Return only the rewritten text — no preamble, no quotation marks, no commentary.',
        ],
        'rewrite_friendly' => [
            'label'              => 'Rewrite: Friendly',
            'mode'               => 'replace',
            'requires_selection' => true,
            'system'             => 'Rewrite the user\'s text in a warm, friendly tone while preserving meaning, structure, and markdown. Return only the rewritten text — no preamble, no quotation marks, no commentary.',
        ],
        'rewrite_concise' => [
            'label'              => 'Rewrite: Concise',
            'mode'               => 'replace',
            'requires_selection' => true,
            'system'             => 'Rewrite the user\'s text to be more concise without losing meaning. Preserve markdown. Return only the rewritten text — no preamble, no quotation marks, no commentary.',
        ],
        'rewrite_expand' => [
            'label'              => 'Rewrite: Expand',
            'mode'               => 'replace',
            'requires_selection' => true,
            'system'             => 'Expand the user\'s text with additional detail and context while staying on topic. Preserve tone, structure, and markdown. Return only the expanded text — no preamble, no commentary.',
        ],
        'continue' => [
            'label'              => 'Continue writing',
            'mode'               => 'insert',
            'requires_selection' => false,
            'system'             => 'Continue writing from where the user\'s text ends. Match the existing tone, voice, and markdown style. Write one or two short paragraphs. Return only the continuation — no preamble, no commentary.',
        ],
        'summarize' => [
            'label'              => 'Summarize',
            'mode'               => 'replace',
            'requires_selection' => true,
            'system'             => 'Summarize the user\'s text in 2–4 sentences. Preserve the key facts and any markdown emphasis. Return only the summary — no preamble, no commentary.',
        ],
        'translate' => [
            'label'              => 'Translate',
            'mode'               => 'replace',
            'requires_selection' => true,
            'params'             => ['target_lang'],
            // target_lang gets inlined into the system prompt at dispatch time.
            'system'             => 'Translate the user\'s text to {target_lang}. Preserve markdown structure. Return only the translation — no preamble, no commentary.',
        ],
        'fix_grammar' => [
            'label'              => 'Fix grammar & spelling',
            'mode'               => 'replace',
            'requires_selection' => true,
            'system'             => 'Fix grammar, spelling, and punctuation in the user\'s text. Do not change the meaning, tone, or voice. Preserve markdown. Return only the corrected text — no preamble, no commentary.',
        ],
        'custom' => [
            'label'              => 'Custom prompt',
            'mode'               => 'replace',
            'requires_selection' => false,
            'params'             => ['custom'],
            'system'             => 'Follow the user\'s instruction precisely. Preserve markdown. Return only the resulting text — no preamble, no commentary. Instruction: {custom}',
        ],
    ];
}

function ai_writing_action(string $id): ?array {
    return ai_writing_actions()[$id] ?? null;
}

// Interpolate {placeholder} markers in a system prompt from a params map.
// Unknown placeholders are stripped (fail-closed). Missing values become
// empty strings.
function ai_render_prompt(string $template, array $params): string {
    return preg_replace_callback(
        '/\{(\w+)\}/',
        fn($m) => isset($params[$m[1]]) ? (string) $params[$m[1]] : '',
        $template
    );
}
