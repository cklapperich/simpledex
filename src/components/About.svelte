<script lang="ts">
  import readmeContent from '../../readme.md?raw';

  // Simple markdown to HTML conversion
  function markdownToHtml(md: string): string {
    return md
      // H2 headers
      .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-gray-900 mt-8 mb-3">$1</h2>')
      // H1 headers
      .replace(/^# (.+)$/gm, '<h1 class="text-4xl font-bold text-gray-900 mb-6">$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      // Links
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Unordered list items
      .replace(/^- (.+)$/gm, '<li class="ml-6 list-disc">$1</li>')
      // Wrap consecutive list items in ul
      .replace(/(<li.*<\/li>\n?)+/g, '<ul class="my-2">$&</ul>')
      // Paragraphs
      .replace(/^(?!<[hul]|<li)(.+)$/gm, '<p class="text-gray-700 my-3">$1</p>')
      // Clean up empty paragraphs
      .replace(/<p class="text-gray-700 my-3"><\/p>/g, '');
  }

  const htmlContent = markdownToHtml(readmeContent);
</script>

<div class="min-h-screen bg-white">
  <div class="max-w-4xl mx-auto px-8 py-8">
    {@html htmlContent}
  </div>
</div>
