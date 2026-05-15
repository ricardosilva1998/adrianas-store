import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { useCallback, useEffect } from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  mode?: "full" | "inline";
};

const COLOR_PALETTE = [
  { label: "Preto", value: "#111111" },
  { label: "Cinza", value: "#6b7280" },
  { label: "Rosa", value: "#ED7396" },
  { label: "Vermelho", value: "#dc2626" },
  { label: "Verde", value: "#16a34a" },
  { label: "Azul", value: "#2563eb" },
  { label: "Amarelo", value: "#ca8a04" },
];

export function RichTextEditor({
  value,
  onChange,
  minHeight = 200,
  mode = "full",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions:
      mode === "inline"
        ? [
            StarterKit.configure({
              heading: false,
              bulletList: false,
              orderedList: false,
              listItem: false,
              blockquote: false,
              codeBlock: false,
              code: false,
              horizontalRule: false,
              strike: false,
            }),
            Underline,
            TextStyle,
            Color,
            Link.configure({
              openOnClick: false,
              autolink: true,
              HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
            }),
          ]
        : [
            StarterKit,
            Underline,
            TextStyle,
            Color,
            Link.configure({
              openOnClick: false,
              autolink: true,
              HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
            }),
            TextAlign.configure({ types: ["heading", "paragraph"] }),
          ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none",
        style: `min-height: ${minHeight}px`,
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && (value || current !== "<p></p>")) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className="rounded-2xl border border-ink-line bg-white px-4 py-3 text-sm text-ink-muted"
        style={{ minHeight }}
      >
        A carregar editor…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-line bg-white">
      <Toolbar editor={editor} inline={mode === "inline"} />
      <div className="px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor, inline = false }: { editor: Editor; inline?: boolean }) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link", previous ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const setColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
  };

  const unsetColor = () => {
    editor.chain().focus().unsetColor().run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-ink-line bg-ink-surface/40 px-2 py-2">
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Negrito"
      >
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Itálico"
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Sublinhado"
      >
        <span className="underline">U</span>
      </ToolbarButton>
      {!inline && (
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Rasurado"
        >
          <span className="line-through">S</span>
        </ToolbarButton>
      )}

      {!inline && (
        <>
          <Divider />

          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Título 2"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Título 3"
          >
            H3
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Lista"
          >
            •
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Lista numerada"
          >
            1.
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Citação"
          >
            ❝
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            title="Alinhar à esquerda"
          >
            ⬅
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            title="Centrar"
          >
            ≡
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            title="Alinhar à direita"
          >
            ➡
          </ToolbarButton>
        </>
      )}

      <Divider />

      <ToolbarButton active={editor.isActive("link")} onClick={setLink} title="Link">
        🔗
      </ToolbarButton>

      <Divider />

      <ColorMenu
        onPick={setColor}
        onClear={unsetColor}
        current={editor.getAttributes("textStyle").color as string | undefined}
      />

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        title="Limpar formatação"
      >
        ⨯
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm transition ${
        active ? "bg-rosa-500 text-white" : "text-ink-soft hover:bg-ink-line/50"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-ink-line" />;
}

function ColorMenu({
  onPick,
  onClear,
  current,
}: {
  onPick: (color: string) => void;
  onClear: () => void;
  current?: string;
}) {
  return (
    <div className="relative inline-flex items-center gap-1">
      <span className="text-xs text-ink-muted">Cor:</span>
      {COLOR_PALETTE.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onPick(c.value)}
          title={c.label}
          aria-label={`Cor ${c.label}`}
          className={`h-5 w-5 rounded-full border transition ${
            current?.toLowerCase() === c.value.toLowerCase()
              ? "border-ink ring-2 ring-ink"
              : "border-ink-line hover:border-ink-soft"
          }`}
          style={{ backgroundColor: c.value }}
        />
      ))}
      <input
        type="color"
        aria-label="Cor personalizada"
        className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
        onChange={(e) => onPick(e.target.value)}
        value={current ?? "#111111"}
      />
      <button
        type="button"
        onClick={onClear}
        title="Limpar cor"
        aria-label="Limpar cor"
        className="ml-1 h-5 w-5 rounded-full border border-ink-line bg-white text-[10px] text-ink-muted hover:border-ink-soft"
      >
        ⨯
      </button>
    </div>
  );
}
