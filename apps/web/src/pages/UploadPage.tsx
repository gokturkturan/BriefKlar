import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router";
import { GUEST_MAX_LETTERS, UPLOAD_LIMITS } from "@briefklar/shared";
import { api, queryKeys } from "../api/client";
import { SignInRequired } from "../components/SignInRequired";
import { useAccount } from "../hooks/useAccount";
import { useErrorText } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";

type ClientError = "invalidType" | "tooLarge";

function validate(file: File): ClientError | null {
  if (!(UPLOAD_LIMITS.acceptedMimeTypes as readonly string[]).includes(file.type)) return "invalidType";
  if (file.size > UPLOAD_LIMITS.maxBytes) return "tooLarge";
  return null;
}

export function UploadPage() {
  const { t, language } = useI18n();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [clientError, setClientError] = useState<ClientError | null>(null);
  const account = useAccount().data;
  const isMember = Boolean(account && !account.guest);

  // A guest has used up their letter once it is uploaded
  const guestLetters = useQuery({
    queryKey: queryKeys.documents,
    queryFn: api.listDocuments,
    enabled: Boolean(account?.guest),
  });
  const guestLetter = account?.guest && guestLetters.data?.length ? guestLetters.data[0] : undefined;

  const upload = useMutation({
    mutationFn: async (file: File) => {
      // A visitor without a session becomes a guest with the first upload
      if (!account) queryClient.setQueryData(queryKeys.account, await api.startGuest(language));
      return api.uploadDocument(file);
    },
    onSuccess: (doc) => {
      queryClient.setQueryData(queryKeys.document(doc.id), { ...doc, analysis: null });
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents });
      void navigate(`/documents/${doc.id}`);
    },
  });

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const error = validate(file);
    setClientError(error);
    if (!error) upload.mutate(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const error = clientError ? t.upload[clientError] : upload.error ? errorText(upload.error) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t.upload.title}</h1>
      <p className="mt-2 text-slate-600">{t.upload.intro}</p>

      {!isMember && (
        <p className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {t.guest.intro(GUEST_MAX_LETTERS)}{" "}
          <Link to="/login" className="font-medium underline">
            {t.auth.login}
          </Link>
        </p>
      )}

      {guestLetter ? (
        <div className="mt-8 space-y-6">
          <Link
            to={`/documents/${guestLetter.id}`}
            className="block rounded-xl border border-slate-200 bg-white px-6 py-5 hover:border-slate-400"
          >
            <span className="text-sm text-slate-500">{t.guest.yourLetter}</span>
            <span className="mt-1 block truncate font-medium text-slate-900" dir="auto">
              {guestLetter.originalName}
            </span>
          </Link>
          <SignInRequired />
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`mt-8 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition ${
            isDragging ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white hover:border-slate-400"
          }`}
        >
          {upload.isPending ? (
            <p className="font-medium text-slate-700">{t.upload.uploading}</p>
          ) : (
            <>
              <p className="font-medium text-slate-800">{t.upload.drop}</p>
              <p className="mt-1 text-sm text-slate-500">{t.upload.hint}</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={UPLOAD_LIMITS.acceptedMimeTypes.join(",")}
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {error && <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <p className="mt-6 text-xs text-slate-500">{t.upload.disclaimer}</p>
    </div>
  );
}
