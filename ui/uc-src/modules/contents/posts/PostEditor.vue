<script lang="ts" setup>
import EditorProviderSelector from "@/components/dropdown-selector/EditorProviderSelector.vue";
import HasPermission from "@/components/permission/HasPermission.vue";
import { useAutoSaveContent } from "@/composables/use-auto-save-content";
import { useContentCache } from "@/composables/use-content-cache";
import { useEditorExtensionPoints } from "@/composables/use-editor-extension-points";
import { useSessionKeepAlive } from "@/composables/use-session-keep-alive";
import { contentAnnotations } from "@/constants/annotations";
import { FormType } from "@/types/slug";
import { randomUUID } from "@/utils/id";
import { usePermission } from "@/utils/permission";
import { useSaveKeybinding } from "@console/composables/use-save-keybinding";
import useSlugify from "@console/composables/use-slugify";
import type { Content, Post, Snapshot } from "@halo-dev/api-client";
import { publicApiClient, ucApiClient } from "@halo-dev/api-client";
import {
  Dialog,
  IconBookRead,
  IconSave,
  IconSendPlaneFill,
  IconSettings,
  Toast,
  VButton,
  VPageHeader,
} from "@halo-dev/components";
import type { EditorProvider } from "@halo-dev/console-shared";
import { useMutation } from "@tanstack/vue-query";
import { usePostUpdateMutate } from "@uc/modules/contents/posts/composables/use-post-update-mutate";
import { useLocalStorage } from "@vueuse/core";
import { useRouteQuery } from "@vueuse/router";
import { AxiosError, type AxiosRequestConfig } from "axios";
import ShortUniqueId from "short-unique-id";
import type { ComputedRef } from "vue";
import { computed, nextTick, onMounted, provide, ref, toRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import PostCreationModal from "./components/PostCreationModal.vue";
import PostSettingEditModal from "./components/PostSettingEditModal.vue";

const uid = new ShortUniqueId();

const router = useRouter();
const { t } = useI18n();
const { currentUserHasPermission } = usePermission();

const formState = ref<Post>({
  apiVersion: "content.halo.run/v1alpha1",
  kind: "Post",
  metadata: {
    annotations: {},
    name: randomUUID(),
  },
  spec: {
    allowComment: true,
    baseSnapshot: "",
    categories: [],
    cover: "",
    deleted: false,
    excerpt: {
      autoGenerate: true,
      raw: "",
    },
    headSnapshot: "",
    htmlMetas: [],
    owner: "",
    pinned: false,
    priority: 0,
    publish: false,
    publishTime: "",
    releaseSnapshot: "",
    slug: "",
    tags: [],
    template: "",
    title: "",
    visible: "PUBLIC",
  },
});

const content = ref<Content>({
  content: "",
  raw: "",
  rawType: "",
});
const snapshot = ref<Snapshot>();

const isTitleChanged = ref(false);
watch(
  () => formState.value.spec.title,
  (newValue, oldValue) => {
    isTitleChanged.value = newValue !== oldValue;
  }
);

const isUpdateMode = computed(
  () => !!formState.value.metadata.creationTimestamp
);

// provide some data to editor
provide<ComputedRef<string | undefined>>(
  "owner",
  computed(() => formState.value.spec.owner)
);
provide<ComputedRef<string | undefined>>(
  "publishTime",
  computed(() => formState.value.spec.publishTime)
);
provide<ComputedRef<string | undefined>>(
  "permalink",
  computed(() => formState.value.status?.permalink)
);

// Editor providers
const { editorProviders, fetchEditorProviders } = useEditorExtensionPoints();
const currentEditorProvider = ref<EditorProvider>();
const storedEditorProviderName = useLocalStorage("editor-provider-name", "");

const handleChangeEditorProvider = async (provider: EditorProvider) => {
  currentEditorProvider.value = provider;

  const { name, rawType } = provider;

  storedEditorProviderName.value = name;

  content.value.rawType = rawType;

  formState.value.metadata.annotations = {
    ...formState.value.metadata.annotations,
    [contentAnnotations.PREFERRED_EDITOR]: name,
  };
};

// Fetch post data when the route contains the name parameter
const name = useRouteQuery<string | undefined>("name");

onMounted(async () => {
  await fetchEditorProviders();

  if (name.value) {
    await getLatestPost();
    await handleFetchContent();
    handleResetCache();
    return;
  }

  // New post, set default editor
  const provider =
    editorProviders.value.find(
      (provider) => provider.name === storedEditorProviderName.value
    ) || editorProviders.value[0];

  if (provider) {
    currentEditorProvider.value = provider;
    content.value.rawType = provider.rawType;
    formState.value.metadata.annotations = {
      [contentAnnotations.PREFERRED_EDITOR]: provider.name,
    };
  }
  handleResetCache();
});

const snapshotVersion = computed(() => snapshot.value?.metadata.version || 0);

// Post content cache
const {
  currentCache,
  handleSetContentCache,
  handleResetCache,
  handleClearCache,
} = useContentCache(
  "post-content-cache",
  name,
  toRef(content.value, "raw"),
  snapshotVersion
);

useAutoSaveContent(currentCache, toRef(content.value, "raw"), async () => {
  // Do not save when the setting modal or the creation modal is open
  if (postSettingEditModal.value || postPublishModal.value) {
    return;
  }
  if (isUpdateMode.value) {
    handleSave({ mute: true });
  } else {
    handleCreate();
  }
});

// Slug generation
const { handleGenerateSlug } = useSlugify(
  computed(() => formState.value.spec.title),
  computed({
    get() {
      return formState.value.spec.slug;
    },
    set(value) {
      formState.value.spec.slug = value;
    },
  }),
  computed(() => !isUpdateMode.value),
  FormType.POST
);

async function getLatestPost() {
  if (!name.value) {
    return;
  }
  const { data: latestPost } = await ucApiClient.content.post.getMyPost({
    name: name.value,
  });

  formState.value = latestPost;
}

/**
 * Fetch content from the head snapshot.
 */
async function handleFetchContent() {
  const { headSnapshot } = formState.value.spec || {};

  if (!headSnapshot || !name.value) {
    return;
  }

  const { data } = await ucApiClient.content.post.getMyPostDraft({
    name: name.value,
    patched: true,
  });

  const {
    [contentAnnotations.PATCHED_CONTENT]: patchedContent,
    [contentAnnotations.PATCHED_RAW]: patchedRaw,
  } = data.metadata.annotations || {};

  const { rawType } = data.spec || {};

  content.value = {
    content: patchedContent,
    raw: patchedRaw,
    rawType,
  };

  snapshot.value = data;

  if (currentEditorProvider.value) {
    return;
  }

  await handleSetEditorProviderFromRemote();
}

async function handleSetEditorProviderFromRemote() {
  const { [contentAnnotations.PREFERRED_EDITOR]: preferredEditorName } =
    formState.value.metadata.annotations || {};

  const preferredEditor = editorProviders.value.find(
    (provider) => provider.name === preferredEditorName
  );

  const provider =
    preferredEditor ||
    editorProviders.value.find(
      (provider) =>
        provider.rawType.toLowerCase() === content.value.rawType?.toLowerCase()
    );

  if (provider) {
    currentEditorProvider.value = provider;

    formState.value.metadata.annotations = {
      ...formState.value.metadata.annotations,
      [contentAnnotations.PREFERRED_EDITOR]: provider.name,
    };
  } else {
    Dialog.warning({
      title: t("core.common.dialog.titles.warning"),
      description: t("core.common.dialog.descriptions.editor_not_found", {
        raw_type: content.value.rawType,
      }),
      confirmText: t("core.common.buttons.confirm"),
      showCancel: false,
      onConfirm: () => {
        router.back();
      },
    });
  }

  await nextTick();
}

// Create post
function handleSaveClick() {
  if (isUpdateMode.value) {
    handleSave({ mute: false });
  } else {
    handleCreate();
  }
}

async function handleCreate() {
  formState.value.metadata.annotations = {
    ...formState.value.metadata.annotations,
    [contentAnnotations.CONTENT_JSON]: JSON.stringify(content.value),
  };
  // Set default title and slug
  if (!formState.value.spec.title) {
    formState.value.spec.title = t("core.post_editor.untitled");
  }

  if (!formState.value.spec.slug) {
    handleGenerateSlug(true);
  }

  // fixme: check if slug is unique
  // Finally, we need to check if the slug is unique in the database
  const { data: postsWithSameSlug } =
    await publicApiClient.content.post.queryPosts({
      fieldSelector: [`spec.slug=${formState.value.spec.slug}`],
    });

  if (postsWithSameSlug.total) {
    formState.value.spec.slug = `${formState.value.spec.slug}-${uid.randomUUID(8)}`;
  }

  const { data: createdPost } = await ucApiClient.content.post.createMyPost({
    post: formState.value,
  });

  await onCreatePostSuccess(createdPost);
}

async function onCreatePostSuccess(data: Post) {
  formState.value = data;
  // Update route query params
  name.value = data.metadata.name;
  await handleFetchContent();
  handleClearCache();
}

// Save post

const { mutateAsync: postUpdateMutate } = usePostUpdateMutate();

const { mutateAsync: handleSave, isLoading: isSaving } = useMutation({
  mutationKey: ["uc:save-post-content"],
  variables: {
    mute: false,
  },
  mutationFn: async () => {
    // Update title
    if (isTitleChanged.value) {
      const { data: updatedPost } = await postUpdateMutate({
        postToUpdate: formState.value,
      });

      formState.value = updatedPost;
      isTitleChanged.value = false;
    }

    // Snapshot always exists in update mode
    if (!snapshot.value) {
      return;
    }

    const { annotations } = snapshot.value.metadata || {};

    snapshot.value.metadata.annotations = {
      ...annotations,
      [contentAnnotations.CONTENT_JSON]: JSON.stringify(content.value),
    };

    if (!isUpdateMode.value || !name.value) {
      return;
    }

    const { data } = await ucApiClient.content.post.updateMyPostDraft({
      name: name.value,
      snapshot: snapshot.value,
    });

    snapshot.value = data;

    return data;
  },
  onSuccess(_, variables) {
    if (!variables.mute) Toast.success(t("core.common.toast.save_success"));
    handleFetchContent();
    handleClearCache(name.value);
  },
  onError() {
    Toast.error(t("core.common.toast.save_failed_and_retry"));
  },
});

useSaveKeybinding(handleSaveClick);

// Publish post

const postPublishModal = ref(false);

function handlePublishClick() {
  if (isUpdateMode.value) {
    handlePublish();
  } else {
    // Set editor title to post
    postPublishModal.value = true;
  }
}

function onPublishPostSuccess() {
  handleClearCache();
  router.push({ name: "Posts" });
}

const { mutateAsync: handlePublish, isLoading: isPublishing } = useMutation({
  mutationKey: ["uc:publish-post"],
  mutationFn: async () => {
    await handleSave({ mute: true });

    return await ucApiClient.content.post.publishMyPost(
      {
        name: formState.value.metadata.name,
      },
      {
        mute: true,
      }
    );
  },
  retry: 3,
  onSuccess() {
    Toast.success(t("core.common.toast.publish_success"), {
      duration: 2000,
    });
    handleClearCache(formState.value.metadata.name);
    router.push({ name: "Posts" });
  },
  onError(error: Error) {
    if (error instanceof AxiosError) {
      const { detail, title } = error.response?.data || {};
      Toast.error(detail || title);
    } else {
      Toast.error(t("core.common.toast.publish_failed_and_retry"));
    }
  },
});

// Post setting
const postSettingEditModal = ref(false);

async function handleOpenPostSettingEditModal() {
  await handleSave({ mute: true });
  await getLatestPost();
  postSettingEditModal.value = true;
}

function onUpdatePostSuccess(data: Post) {
  formState.value = data;
  handleFetchContent();
  handleClearCache(data.metadata.name);
}

// Upload image
async function handleUploadImage(file: File, options?: AxiosRequestConfig) {
  if (!currentUserHasPermission(["uc:attachments:manage"])) {
    return;
  }

  const { data } = await ucApiClient.storage.attachment.createAttachmentForPost(
    {
      file,
      postName: formState.value.metadata.name,
      waitForPermalink: true,
    },
    options
  );
  return data;
}

// Keep session alive
useSessionKeepAlive();
</script>

<template>
  <VPageHeader :title="$t('core.post.title')">
    <template #icon>
      <IconBookRead />
    </template>
    <template #actions>
      <EditorProviderSelector
        v-if="editorProviders.length > 1"
        :provider="currentEditorProvider"
        :allow-forced-select="!isUpdateMode"
        @select="handleChangeEditorProvider"
      />
      <VButton
        size="sm"
        type="default"
        :loading="isSaving && !isPublishing"
        @click="handleSaveClick"
      >
        <template #icon>
          <IconSave />
        </template>
        {{ $t("core.common.buttons.save") }}
      </VButton>
      <VButton
        v-if="isUpdateMode"
        size="sm"
        type="default"
        @click="handleOpenPostSettingEditModal"
      >
        <template #icon>
          <IconSettings />
        </template>
        {{ $t("core.common.buttons.setting") }}
      </VButton>
      <HasPermission :permissions="['uc:posts:publish']">
        <VButton
          :loading="isPublishing"
          type="secondary"
          @click="handlePublishClick"
        >
          <template #icon>
            <IconSendPlaneFill />
          </template>
          {{ $t("core.common.buttons.publish") }}
        </VButton>
      </HasPermission>
    </template>
  </VPageHeader>
  <div class="editor border-t" style="height: calc(100vh - 3.5rem)">
    <component
      :is="currentEditorProvider.component"
      v-if="currentEditorProvider"
      v-model:raw="content.raw"
      v-model:content="content.content"
      v-model:title="formState.spec.title"
      :upload-image="handleUploadImage"
      class="h-full"
      @update="handleSetContentCache"
    />
  </div>

  <PostCreationModal
    v-if="postPublishModal"
    :title="$t('core.uc_post.publish_modal.title')"
    :post="formState"
    :content="content"
    publish
    @close="postPublishModal = false"
    @success="onPublishPostSuccess"
  />

  <PostSettingEditModal
    v-if="postSettingEditModal"
    :post="formState"
    @close="postSettingEditModal = false"
    @success="onUpdatePostSuccess"
  />
</template>
