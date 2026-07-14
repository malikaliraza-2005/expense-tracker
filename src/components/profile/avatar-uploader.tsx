'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Upload } from 'lucide-react';
import { toast } from 'sonner';

import { uploadAvatar } from '@/actions/profile';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  AVATAR_ALLOWED_TYPES,
  AVATAR_MAX_BYTES,
} from '@/schemas/profile.schema';

/**
 * Avatar uploader (Client Component). Picks an image, previews it locally, and
 * posts it to the `uploadAvatar` Server Action as `FormData`. File type/size are
 * checked here for instant feedback and re-checked in the action (client checks
 * are never trusted). On success the server-recorded URL replaces the preview
 * and the shell refreshes so the new avatar shows everywhere.
 */
export function AvatarUploader({
  name,
  avatarUrl,
}: {
  name: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Revoke the object URL when the preview changes or the component unmounts.
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function onSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!(AVATAR_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Use a PNG, JPEG, WebP, or GIF image.');
      event.target.value = '';
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error('Image must be 2 MB or smaller.');
      event.target.value = '';
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    const formData = new FormData();
    formData.append('avatar', file);

    startTransition(async () => {
      const result = await uploadAvatar(formData);
      if (!result.ok) {
        toast.error(result.error);
        setPreview(null);
        return;
      }
      toast.success('Avatar updated.');
      router.refresh();
    });

    // Allow re-selecting the same file later.
    event.target.value = '';
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar
        name={name}
        src={preview ?? avatarUrl}
        className="h-16 w-16 text-lg"
      />
      <div className="space-y-1">
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ALLOWED_TYPES.join(',')}
          className="sr-only"
          onChange={onSelect}
          disabled={isPending}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
        >
          <Upload />
          {isPending ? 'Uploading…' : 'Change avatar'}
        </Button>
        <p className="text-xs text-muted-foreground">PNG, JPEG, WebP or GIF, up to 2 MB.</p>
      </div>
    </div>
  );
}
