<script lang="ts" setup>
import AnnotationsForm from "@/components/form/AnnotationsForm.vue";
import { postLabels } from "@/constants/labels";
import { FormType } from "@/types/slug";
import { formatDatetime, toDatetimeLocal, toISOString } from "@/utils/date";
import { randomUUID } from "@/utils/id";
import useSlugify from "@console/composables/use-slugify";
import { useThemeCustomTemplates } from "@console/modules/interface/themes/composables/use-theme";
import { submitForm, type FormKitNode } from "@formkit/core";
import type { Post } from "@halo-dev/api-client";
import { consoleApiClient, coreApiClient } from "@halo-dev/api-client";
import {
  IconRefreshLine,
  Toast,
  VButton,
  VModal,
  VSpace,
} from "@halo-dev/components";
import { cloneDeep } from "lodash-es";
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { usePostUpdateMutate } from "../composables/use-post-update-mutate";

const props = withDefaults(
  defineProps<{
    post?: Post;
    publishSupport?: boolean;
    onlyEmit?: boolean;
  }>(),
  {
    post: undefined,
    publishSupport: true,
    onlyEmit: false,
  }
);

const emit = defineEmits<{
  (event: "close"): void;
  (event: "saved", post: Post): void;
  (event: "published", post: Post): void;
}>();

const { t } = useI18n();

const modal = ref<InstanceType<typeof VModal>>();
const formState = ref<Post>({
  spec: {
    title: "",
    slug: "",
    template: "",
    cover: "",
    deleted: false,
    publish: false,
    publishTime: undefined,
    pinned: false,
    allowComment: true,
    visible: "PUBLIC",
    priority: 0,
    excerpt: {
      autoGenerate: true,
      raw: "",
    },
    categories: [],
    tags: [],
    htmlMetas: [],
  },
  apiVersion: "content.halo.run/v1alpha1",
  kind: "Post",
  metadata: {
    name: randomUUID(),
  },
});
const isSubmitting = ref(false);
const publishing = ref(false);
const publishCanceling = ref(false);
const submitType = ref<"publish" | "save">();
const publishTime = ref<string | undefined>(undefined);

const isUpdateMode = computed(() => {
  return !!formState.value.metadata.creationTimestamp;
});

const handleSubmit = () => {
  if (submitType.value === "publish") {
    handlePublish();
  }
  if (submitType.value === "save") {
    handleSave();
  }
};

const handleSaveClick = () => {
  submitType.value = "save";

  nextTick(() => {
    submitForm("post-setting-form");
  });
};

const handlePublishClick = () => {
  submitType.value = "publish";

  nextTick(() => {
    submitForm("post-setting-form");
  });
};

// Fix me:
// Force update post settings,
// because currently there may be errors caused by changes in version due to asynchronous processing.
const { mutateAsync: postUpdateMutate } = usePostUpdateMutate();

const handleSave = async () => {
  annotationsFormRef.value?.handleSubmit();
  await nextTick();

  const { customAnnotations, annotations, customFormInvalid, specFormInvalid } =
    annotationsFormRef.value || {};

  if (customFormInvalid || specFormInvalid) {
    return;
  }

  formState.value.metadata.annotations = {
    ...annotations,
    ...customAnnotations,
  };

  if (props.onlyEmit) {
    emit("saved", formState.value);
    modal.value?.close();
    return;
  }

  try {
    isSubmitting.value = true;

    const { data } = isUpdateMode.value
      ? await postUpdateMutate(formState.value)
      : await coreApiClient.content.post.createPost({
          post: formState.value,
        });

    formState.value = data;
    emit("saved", data);

    modal.value?.close();

    Toast.success(t("core.common.toast.save_success"));
  } catch (e) {
    console.error("Failed to save post", e);
  } finally {
    isSubmitting.value = false;
  }
};

const handlePublish = async () => {
  if (props.onlyEmit) {
    emit("published", formState.value);
    modal.value?.close();
    return;
  }

  try {
    publishing.value = true;

    await postUpdateMutate(formState.value);

    const { data } = await consoleApiClient.content.post.publishPost({
      name: formState.value.metadata.name,
    });

    formState.value = data;

    emit("published", data);

    modal.value?.close();

    Toast.success(t("core.common.toast.publish_success"));
  } catch (e) {
    console.error("Failed to publish post", e);
  } finally {
    publishing.value = false;
  }
};

const handleUnpublish = async () => {
  try {
    publishCanceling.value = true;

    await consoleApiClient.content.post.unpublishPost({
      name: formState.value.metadata.name,
    });

    modal.value?.close();

    Toast.success(t("core.common.toast.cancel_publish_success"));
  } catch (e) {
    console.error("Failed to publish post", e);
  } finally {
    publishCanceling.value = false;
  }
};

// publish time
watch(
  () => props.post,
  (value) => {
    if (value) {
      formState.value = cloneDeep(value);
      publishTime.value = toDatetimeLocal(formState.value.spec.publishTime);
    }
  },
  {
    immediate: true,
  }
);

watch(
  () => publishTime.value,
  (value) => {
    formState.value.spec.publishTime = value ? toISOString(value) : undefined;
  }
);

const isScheduledPublish = computed(() => {
  return (
    formState.value.spec.publishTime &&
    new Date(formState.value.spec.publishTime) > new Date()
  );
});

const publishTimeHelp = computed(() => {
  return isScheduledPublish.value
    ? t("core.post.settings.fields.publish_time.help.schedule_publish", {
        datetime: formatDatetime(publishTime.value),
      })
    : "";
});

// custom templates
const { templates } = useThemeCustomTemplates("post");

const annotationsFormRef = ref<InstanceType<typeof AnnotationsForm>>();

// slug
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

// fixme: check if slug is unique
// Finally, we need to check if the slug is unique in the database
async function slugUniqueValidation(node: FormKitNode) {
  const value = node.value;
  if (!value) {
    return true;
  }

  const fieldSelector = [`spec.slug=${value}`];

  if (isUpdateMode.value) {
    fieldSelector.push(`metadata.name!=${formState.value.metadata.name}`);
  }

  const { data: postsWithSameSlug } = await coreApiClient.content.post.listPost(
    {
      fieldSelector,
    }
  );

  return !postsWithSameSlug.total;
}

// Buttons condition
const showPublishButton = computed(() => {
  if (!props.publishSupport) {
    return false;
  }

  const {
    [postLabels.PUBLISHED]: published,
    [postLabels.SCHEDULING_PUBLISH]: schedulingPublish,
  } = formState.value.metadata.labels || {};

  return published !== "true" && schedulingPublish !== "true";
});

const showCancelPublishButton = computed(() => {
  const {
    [postLabels.PUBLISHED]: published,
    [postLabels.SCHEDULING_PUBLISH]: schedulingPublish,
  } = formState.value.metadata.labels || {};

  return published === "true" || schedulingPublish === "true";
});
</script>
<template>
  <VModal
    ref="modal"
    :width="700"
    :title="$t('core.post.settings.title')"
    :centered="false"
    @close="emit('close')"
  >
    <template #actions>
      <slot name="actions"></slot>
    </template>

    <FormKit
      id="post-setting-form"
      type="form"
      name="post-setting-form"
      :config="{ validationVisibility: 'submit' }"
      @submit="handleSubmit"
    >
      <div>
        <div class="md:grid md:grid-cols-4 md:gap-6">
          <div class="md:col-span-1">
            <div class="sticky top-0">
              <span class="text-base font-medium text-gray-900">
                {{ $t("core.post.settings.groups.general") }}
              </span>
            </div>
          </div>
          <div class="mt-5 divide-y divide-gray-100 md:col-span-3 md:mt-0">
            <FormKit
              v-model="formState.spec.title"
              :label="$t('core.post.settings.fields.title.label')"
              type="text"
              name="title"
              validation="required|length:0,100"
            ></FormKit>
            <FormKit
              v-model="formState.spec.slug"
              :label="$t('core.post.settings.fields.slug.label')"
              name="slug"
              type="text"
              validation="required|length:0,100|slugUniqueValidation"
              :validation-rules="{ slugUniqueValidation }"
              :validation-messages="{
                slugUniqueValidation: $t(
                  'core.common.form.validation.slug_unique'
                ),
              }"
              :help="$t('core.post.settings.fields.slug.help')"
            >
              <template #suffix>
                <div
                  v-tooltip="
                    $t('core.post.settings.fields.slug.refresh_message')
                  "
                  class="group flex h-full cursor-pointer items-center border-l px-3 transition-all hover:bg-gray-100"
                  @click="handleGenerateSlug(true)"
                >
                  <IconRefreshLine
                    class="h-4 w-4 text-gray-500 group-hover:text-gray-700"
                  />
                </div>
              </template>
            </FormKit>
            <FormKit
              v-model="formState.spec.categories"
              :label="$t('core.post.settings.fields.categories.label')"
              name="categories"
              type="categorySelect"
              :multiple="true"
            />
            <FormKit
              v-model="formState.spec.tags"
              :label="$t('core.post.settings.fields.tags.label')"
              name="tags"
              type="tagSelect"
              :multiple="true"
            />
            <FormKit
              v-model="formState.spec.excerpt.autoGenerate"
              name="autoGenerate"
              :label="
                $t('core.post.settings.fields.auto_generate_excerpt.label')
              "
              type="checkbox"
            >
            </FormKit>
            <FormKit
              v-if="!formState.spec.excerpt.autoGenerate"
              v-model="formState.spec.excerpt.raw"
              :label="$t('core.post.settings.fields.raw_excerpt.label')"
              name="raw"
              type="textarea"
              :rows="5"
              validation="length:0,1024"
            ></FormKit>
          </div>
        </div>

        <div class="py-5">
          <div class="border-t border-gray-200"></div>
        </div>

        <div class="md:grid md:grid-cols-4 md:gap-6">
          <div class="md:col-span-1">
            <div class="sticky top-0">
              <span class="text-base font-medium text-gray-900">
                {{ $t("core.post.settings.groups.advanced") }}
              </span>
            </div>
          </div>
          <div class="mt-5 divide-y divide-gray-100 md:col-span-3 md:mt-0">
            <FormKit
              v-model="formState.spec.owner"
              :label="$t('core.post.settings.fields.owner.label')"
              type="userSelect"
            ></FormKit>
            <FormKit
              v-model="formState.spec.allowComment"
              :label="$t('core.post.settings.fields.allow_comment.label')"
              type="checkbox"
            ></FormKit>
            <FormKit
              v-model="formState.spec.pinned"
              :label="$t('core.post.settings.fields.pinned.label')"
              name="pinned"
              type="checkbox"
            ></FormKit>
            <FormKit
              v-model="formState.spec.visible"
              :options="[
                { label: $t('core.common.select.public'), value: 'PUBLIC' },
                {
                  label: $t('core.common.select.private'),
                  value: 'PRIVATE',
                },
              ]"
              :label="$t('core.post.settings.fields.visible.label')"
              name="visible"
              type="select"
            ></FormKit>
            <FormKit
              v-model="publishTime"
              :label="$t('core.post.settings.fields.publish_time.label')"
              type="datetime-local"
              min="0000-01-01T00:00"
              max="9999-12-31T23:59"
              :help="publishTimeHelp"
            ></FormKit>
            <FormKit
              v-model="formState.spec.template"
              :options="templates"
              :label="$t('core.post.settings.fields.template.label')"
              name="template"
              type="select"
            ></FormKit>
            <FormKit
              v-model="formState.spec.cover"
              name="cover"
              :label="$t('core.post.settings.fields.cover.label')"
              type="attachment"
              :accepts="['image/*']"
              validation="length:0,1024"
            ></FormKit>
          </div>
        </div>
      </div>
    </FormKit>

    <div class="py-5">
      <div class="border-t border-gray-200"></div>
    </div>

    <div class="md:grid md:grid-cols-4 md:gap-6">
      <div class="md:col-span-1">
        <div class="sticky top-0">
          <span class="text-base font-medium text-gray-900">
            {{ $t("core.post.settings.groups.annotations") }}
          </span>
        </div>
      </div>
      <div class="mt-5 divide-y divide-gray-100 md:col-span-3 md:mt-0">
        <AnnotationsForm
          :key="formState.metadata.name"
          ref="annotationsFormRef"
          :value="formState.metadata.annotations"
          kind="Post"
          group="content.halo.run"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <VSpace>
          <VButton
            v-if="showPublishButton"
            :loading="publishing"
            type="secondary"
            @click="handlePublishClick()"
          >
            {{
              isScheduledPublish
                ? $t("core.common.buttons.schedule_publish")
                : $t("core.common.buttons.publish")
            }}
          </VButton>
          <VButton
            :loading="isSubmitting"
            type="secondary"
            @click="handleSaveClick()"
          >
            {{ $t("core.common.buttons.save") }}
          </VButton>
          <VButton type="default" @click="modal?.close()">
            {{ $t("core.common.buttons.close") }}
          </VButton>
        </VSpace>

        <VButton
          v-if="showCancelPublishButton"
          :loading="publishCanceling"
          type="danger"
          ghost
          @click="handleUnpublish()"
        >
          {{ $t("core.common.buttons.cancel_publish") }}
        </VButton>
      </div>
    </template>
  </VModal>
</template>
