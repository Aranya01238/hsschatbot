const fs = require('fs');
let content = fs.readFileSync('nurse-maya.tsx', 'utf8');

const target = `      {/* Input Area */}
      <div className="p-6 bg-white border-t border-slate-200 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); ask(); }}
          className="flex gap-3 items-end"
        >
          <div className="flex-1">
            <Input
              placeholder="Describe your symptoms... (e.g., 'I have a headache and fever for 2 days')"
              className="min-h-[52px] bg-slate-50 border-slate-300 focus-visible:ring-blue-500 focus-visible:ring-offset-0 rounded-xl text-base px-4 py-3"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            disabled={!query.trim() || loading}
            className={cn(
              "size-[52px] rounded-xl shrink-0 transition-all duration-300 shadow-lg",
              query.trim() && !loading`;

const replacement = `      {/* Input Area */}
      <div className="p-6 bg-white border-t border-slate-200 shrink-0">
        {/* PDF PDF upload UI Integration */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              onChange={handlePdfUpload}
              className="hidden"
              disabled={isUploading || loading}
            />
            {!selectedFile ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading || loading}
                onClick={() => fileInputRef.current?.click()}
                className="text-slate-500 hover:text-blue-600 rounded-lg text-xs"
                title="Attach PDF Document"
              >
                <Paperclip className="size-4 mr-1" />
                {isUploading ? "Uploading..." : "Attach PDF"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 text-xs">
                <FileText className="size-4" />
                <span className="max-w-[200px] truncate font-medium">
                  {selectedFile.name}
                </span>
                <button
                  type="button"
                  onClick={removePdf}
                  className="hover:bg-blue-200 rounded-full p-0.5 transition-colors ml-1"
                  disabled={isUploading || loading}
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            {isUploading && <div className="text-xs text-blue-500 flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Parsing...</div>}
          </div>
          {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); ask(); }}
          className="flex gap-3 items-end"
        >
          <div className="flex-1">
            <Input
              placeholder={isUploading ? "Uploading PDF..." : "Describe your symptoms or ask about the uploaded document..."}
              className="min-h-[52px] bg-slate-50 border-slate-300 focus-visible:ring-blue-500 focus-visible:ring-offset-0 rounded-xl text-base px-4 py-3"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || isUploading}
            />
          </div>

          <Button
            type="submit"
            disabled={!query.trim() || loading || isUploading}
            className={cn(
              "size-[52px] rounded-xl shrink-0 transition-all duration-300 shadow-lg",
              query.trim() && !loading && !isUploading`;

content = content.replace(target, replacement);
fs.writeFileSync('nurse-maya.tsx', content);
