<script lang="ts">
  import { selectedLanguage, SUPPORTED_LANGUAGES } from '../stores/language';
  import { isLoading } from '../stores/cards';

  let isOpen = $state(false);

  // Get current language info
  const currentLang = $derived(
    SUPPORTED_LANGUAGES.find(lang => lang.code === $selectedLanguage) || SUPPORTED_LANGUAGES[0]
  );

  // Group languages by dataset
  const westernLanguages = $derived(
    SUPPORTED_LANGUAGES.filter(lang => lang.dataset === 'western')
  );
  const asianLanguages = $derived(
    SUPPORTED_LANGUAGES.filter(lang => lang.dataset === 'asian')
  );

  function selectLanguage(code: string) {
    selectedLanguage.set(code);
    isOpen = false;
  }

  // Close dropdown when clicking outside
  $effect(() => {
    if (isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.language-selector')) {
          isOpen = false;
        }
      };

      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  });
</script>

<div class="language-selector relative inline-block">
  <button
    class="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
    onclick={() => isOpen = !isOpen}
  >
    <span class="text-xl">{currentLang.flag}</span>
    <span class="font-medium text-gray-700">{currentLang.label}</span>
    <svg
      class="w-4 h-4 text-gray-500 transition-transform"
      class:rotate-180={isOpen}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {#if isOpen}
    <div class="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[220px] max-h-[400px] overflow-y-auto">
      <!-- Western Languages -->
      <div class="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Western
      </div>
      {#each westernLanguages as lang (lang.code)}
        <button
          class="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
          class:bg-blue-50={lang.code === $selectedLanguage}
          class:text-blue-600={lang.code === $selectedLanguage}
          onclick={() => selectLanguage(lang.code)}
        >
          <span class="flex items-center gap-2">
            <span class="text-xl">{lang.flag}</span>
            <span class="font-medium">{lang.label}</span>
          </span>
          {#if lang.code === $selectedLanguage}
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          {/if}
        </button>
      {/each}

      <!-- Divider -->
      <div class="my-1 border-t border-gray-200"></div>

      <!-- Asian Languages -->
      <div class="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Asian
      </div>
      {#each asianLanguages as lang (lang.code)}
        <button
          class="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
          class:bg-blue-50={lang.code === $selectedLanguage}
          class:text-blue-600={lang.code === $selectedLanguage}
          onclick={() => selectLanguage(lang.code)}
        >
          <span class="flex items-center gap-2">
            <span class="text-xl">{lang.flag}</span>
            <span class="font-medium">{lang.label}</span>
          </span>
          {#if lang.code === $selectedLanguage}
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Loading indicator overlay -->
  {#if $isLoading}
    <div class="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-[60]">
      <div class="bg-white rounded-lg shadow-xl p-6 flex flex-col items-center gap-3">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <div class="text-gray-700 font-medium">Loading cards...</div>
      </div>
    </div>
  {/if}
</div>
