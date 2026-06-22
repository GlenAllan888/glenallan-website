/**
 * Simple line-based diff using the LCS (Longest Common Subsequence) algorithm.
 * Returns an array of { type: 'equal' | 'add' | 'remove', line: string } objects.
 */
export function diffLines(oldText, newText) {
    if (oldText === newText) {
        return oldText.split('\n').map(line => ({ type: 'equal', line }));
    }

    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    // For very large files, fall back to a simple sequential comparison
    if (oldLines.length > 2000 || newLines.length > 2000) {
        return simpleDiff(oldLines, newLines);
    }

    // Build LCS table
    const m = oldLines.length;
    const n = newLines.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Backtrack to produce diff
    const result = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            result.push({ type: 'equal', line: oldLines[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.push({ type: 'add', line: newLines[j - 1] });
            j--;
        } else {
            result.push({ type: 'remove', line: oldLines[i - 1] });
            i--;
        }
    }

    result.reverse();
    return result;
}

function simpleDiff(oldLines, newLines) {
    const result = [];
    let i = 0, j = 0;
    while (i < oldLines.length && j < newLines.length) {
        if (oldLines[i] === newLines[j]) {
            result.push({ type: 'equal', line: oldLines[i] });
            i++; j++;
        } else {
            result.push({ type: 'remove', line: oldLines[i] });
            i++;
        }
    }
    while (i < oldLines.length) {
        result.push({ type: 'remove', line: oldLines[i++] });
    }
    while (j < newLines.length) {
        result.push({ type: 'add', line: newLines[j++] });
    }
    return result;
}
