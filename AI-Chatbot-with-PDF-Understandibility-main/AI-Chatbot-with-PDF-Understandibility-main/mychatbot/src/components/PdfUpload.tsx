import React, { useRef } from "react"
import { Paperclip, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PdfUploadProps {
    onFileSelect: (file: File | null) => void
    selectedFile: File | null
    isUploading: boolean
}

export function PdfUpload({ onFileSelect, selectedFile, isUploading }: PdfUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file && file.type === "application/pdf") {
            onFileSelect(file)
        } else if (file) {
            alert("Please upload a valid PDF file.")
        }
        // Reset the input value so the same file can be selected again if removed
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    return (
        <div className="flex items-center">
            <input
                type="file"
                accept="application/pdf"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
            />

            {!selectedFile ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="text-slate-400 hover:text-[var(--brand-primary)] hover:bg-slate-100 rounded-full"
                    title="Attach PDF Document"
                >
                    <Paperclip className="size-5" />
                </Button>
            ) : (
                <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200 text-xs">
                    <FileText className="size-4" />
                    <span className="max-w-[120px] truncate font-medium">
                        {selectedFile.name}
                    </span>
                    <button
                        type="button"
                        onClick={() => onFileSelect(null)}
                        className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        disabled={isUploading}
                    >
                        <X className="size-3" />
                    </button>
                </div>
            )}
        </div>
    )
}
