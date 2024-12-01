<script lang="ts">
    import { createHash } from 'crypto';
	import type TWPlugin from 'src/main';
	import { getGlobalContext, type SuggestionPatterns } from 'src/util';
	import { createEventDispatcher, onMount } from 'svelte';
	const dispatch = createEventDispatcher();

    let suggestions: string[] = [];
	let suggestionBox: HTMLDivElement;
	let suggestionBoxAdjustmentPending: boolean = false;
	let selectedIndex: number = -1;
	let suggestionEscaped: boolean = false;

	const plugin: TWPlugin = getGlobalContext();

	export let patterns: SuggestionPatterns;
	export let value: string;
	export let autofocus: boolean = false;
	export let placeholder: string = '';

	function _autofocus(node: HTMLTextAreaElement) {
		if (autofocus) node.focus();
	}

    let inputElement: HTMLTextAreaElement;
    let inputAdjustmentPending: boolean = false;

	onMount(() => {
		inputElement.value = value;
		recalculateSuggestionBox();
	})
    
	function getSuggestions(incoming: string, all: string[]): string[] {
		return all
			.map((tag) => ({ tag, distance: levenshtein(tag, incoming) }))
			.sort((a, b) => a.distance - b.distance)
			.map(({ tag }) => tag)
			.slice(0, 10);
	}

	function textToId6(text: string) {
		return createHash("sha1").update(text).digest().readUint8(0) % 6;
	}

	function recalculateSuggestionBox(node?: HTMLDivElement) {
		if (suggestions.length === 0) return;
		let targetNode = node ?? suggestionBox;
		if (!targetNode) return;

		// Position below cursor
		const cursor = inputElement.selectionStart;
		const textBeforeCursor = inputElement.value.substring(0, cursor);
		const textAfterCursor = inputElement.value.substring(cursor);

		// mirrored div
		const mirror = document.createElement("div");
		// copy style from input
		const style = getComputedStyle(inputElement);
		for (let i = 0; i < style.length; i++) {
			// @ts-ignore
			mirror.style[style[i]] = style[style[i]];
		}

		const pre = document.createTextNode(textBeforeCursor);
		const post = document.createTextNode(textAfterCursor);
		const caretEl = document.createElement("span");
		caretEl.innerHTML = "&nbsp;";

		mirror.innerHTML = "";
		mirror.append(pre, caretEl, post);

		document.body.append(mirror);

		const rect = caretEl.getBoundingClientRect();
		const rect2 = mirror.getBoundingClientRect();
		const inputElementRect = inputElement.getBoundingClientRect();

		document.body.removeChild(mirror);

		// Add one more line height to the top
		const textInputLineHeight = inputElement.clientHeight;

		targetNode.style.top = `${inputElementRect.y + rect.y - rect2.y + textInputLineHeight}px`;
		targetNode.style.left = `${inputElementRect.x + rect.x - rect2.x}px`;

		suggestionBoxAdjustmentPending = false;
	}

    function isSuggestionsValid() {
        return suggestions.length > 0 && selectedIndex !== -1 && !suggestionEscaped
    }

	function isSuggestionsVisible() {
		return suggestions.length > 0 && !suggestionEscaped;
	}

	function levenshtein(a: string, b: string): number {
		const matrix = Array.from({ length: a.length + 1 }, () =>
			Array(b.length + 1).fill(0),
		);

		for (let i = 0; i <= a.length; i++) {
			matrix[i][0] = i;
		}
		for (let j = 0; j <= b.length; j++) {
			matrix[0][j] = j;
		}

		for (let i = 1; i <= a.length; i++) {
			for (let j = 1; j <= b.length; j++) {
				if (a[i - 1] === b[j - 1]) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j] + 1,
						matrix[i][j - 1] + 1,
						matrix[i - 1][j - 1] + 1,
					);
				}
			}
		}

		return matrix[a.length][b.length];
	}

	function applySuggestions() {
		if (selectedIndex !== -1 && suggestions.length > 0) {
			const cursor = inputElement.selectionStart;
			let start = cursor;
			let end = cursor;

			while (
				start > 0 &&
				value[start - 1] !== " " &&
				value[start - 1] !== "\n"
			) {
				start--;
			}

			while (
				end < value.length &&
				value[end] !== " " &&
				value[end] !== "\n"
			) {
				end++;
			}

			const word = value.substring(start, cursor);

			let endPos = end;
			
			// Find the current pattern
			const patternIndex = patterns.findIndex(({ pattern }) => word.startsWith(pattern));

			if (patternIndex !== -1) {
				value =
					value.substring(0, start) +
					patterns[patternIndex].pattern +
					suggestions[selectedIndex] +
					value.substring(end);
				endPos = start + patterns[patternIndex].pattern.length + suggestions[selectedIndex].length;
			}

			inputElement.value = value;
			inputElement.selectionStart = endPos;
			inputElement.selectionEnd = endPos;
			inputElement.focus();

			selectedIndex = -1;
			suggestionEscaped = true;
		}
	}

    function adjustInputHeight() {
        inputElement.style.height = '1.5em';
        inputElement.style.height = (inputElement.scrollHeight) + 'px';
        inputAdjustmentPending = false;
    }
    
</script>

<div>    
    <textarea
		bind:this={inputElement}
		class="command-input"
		use:_autofocus
		tabindex="0"
		placeholder="{placeholder}"
		id="create-command"
		on:keyup={(e) => {
            
			let preventEmittion = false;
            
            if (isSuggestionsValid()) {
				if (e.key === "Enter" && e.shiftKey === false) {
                    plugin.logger?.debug_log('Suggestion is valid and trying to enter!')

					applySuggestions();
					
					preventEmittion = true;
					e.preventDefault();
					e.stopImmediatePropagation();
					e.stopPropagation();
                }
            }
		}}
		on:keyup
		
        on:keydown={(e) => {
			
			let preventEmittion = false;

            if (isSuggestionsVisible()) {
                if (e.key === "ArrowDown") {
                    selectedIndex++;
                    if (selectedIndex >= suggestions.length) selectedIndex = selectedIndex % suggestions.length;
                    preventEmittion = true;
					e.stopImmediatePropagation();
                }

                if (e.key === "ArrowUp") {
                    selectedIndex--;
                    if (selectedIndex < 0) selectedIndex = suggestions.length - 1;
					preventEmittion = true;
                    e.stopImmediatePropagation();
                }

                if (e.key === "Escape") {
					suggestionEscaped = true
					preventEmittion = true;
					e.stopImmediatePropagation();
					e.preventDefault();
				};

				if (isSuggestionsValid() && e.key === "Enter") {
					preventEmittion = true;
					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation();
				}
            }
		}}
		on:keydown

		
        bind:value={value}
		
		
        on:input={(e) => {
			dispatch('input', e);

            if (!inputAdjustmentPending) {
				inputAdjustmentPending = true;
				requestAnimationFrame(adjustInputHeight);
			}
			
			// Handle suggestion tag input
			const currentCursor = inputElement.selectionStart;
			let cursor = currentCursor;
			const currentChar = value[currentCursor - 1];

			while (
				cursor > 0 &&
				value[cursor - 1] !== " " &&
				value[cursor - 1] !== "\n"
			) {
				cursor--;
			}

			const currentWord = value.substring(cursor, currentCursor);
			const patternIndex = patterns.findIndex(({ pattern }) => currentWord.startsWith(pattern));

			if (patternIndex === -1) {
				suggestions = [];
				selectedIndex = -1;
				suggestionEscaped = false;
			} else {
				// TODO: show a loading suggestion
				// TODO: only fetch list if the pattern is different?
				patterns[patternIndex].getList(currentWord).then((incomingList) => {
					suggestions = getSuggestions(currentWord, incomingList);
				});
			}

			if (!suggestionBoxAdjustmentPending && suggestions.length > 0 && !suggestionEscaped) {
				suggestionBoxAdjustmentPending = true;
				requestAnimationFrame(() => recalculateSuggestionBox());
			}
		}}

		{...$$restProps}
	/>

	{#if suggestions.length > 0 && !suggestionEscaped}
		<div
			class="suggestions-container"
			bind:this={suggestionBox}
			use:recalculateSuggestionBox
		>
			{#each suggestions as suggestion, i}
				<span
					class="suggestion {`accent-${textToId6(suggestion) + 1}`}"
					class:selected={i === selectedIndex}
				>
					{suggestion}
				</span>
			{/each}
		</div>
	{/if}
</div>


<style>
    .suggestions-container {
        position: fixed; /* Change to fixed to position relative to the viewport */
        width: 200px;
        overflow-y: auto;
        background: var(--background-secondary-alt);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        z-index: 9999; /* Increase z-index to ensure it appears above the modal */
    }
  
    .suggestion {
        display: block;
        width: 100%;
        font-size: 0.8em;
        padding: 0px;
        padding-left: 10px;
        border: none;
        background: none;
        text-align: left;
        cursor: pointer;
    }
    
    .accent-1 { color: var(--accent-1); background-color: rgba(var(--accent-1-rgb), 0.01); }
    .accent-2 { color: var(--accent-2); background-color: rgba(var(--accent-2-rgb), 0.01); }
    .accent-3 { color: var(--accent-3); background-color: rgba(var(--accent-3-rgb), 0.01); }
    .accent-4 { color: var(--accent-4); background-color: rgba(var(--accent-4-rgb), 0.01); }
    .accent-5 { color: var(--accent-5); background-color: rgba(var(--accent-5-rgb), 0.01); }
    .accent-6 { color: var(--accent-6); background-color: rgba(var(--accent-6-rgb), 0.01); }

    .suggestion:hover {
        background-color: var(--background-primary);
        color: var(--text-accent);
    }
    
    .command-input {
        width: 100%;
        height: 1.9em;
        resize: none;
        overflow-y: hidden;
        box-sizing: border-box;
    }

    .suggestion.selected {
        background-color: var(--background-primary);
        color: var(--text-accent);
    }
</style>