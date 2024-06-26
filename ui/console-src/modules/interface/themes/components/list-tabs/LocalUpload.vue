<script lang="ts" setup>
import AppDownloadAlert from "@/components/common/AppDownloadAlert.vue";
import { useThemeStore } from "@console/stores/theme";
import { consoleApiClient } from "@halo-dev/api-client";
import { Dialog, Toast } from "@halo-dev/components";
import { useQueryClient } from "@tanstack/vue-query";
import type { ErrorResponse, UppyFile } from "@uppy/core";
import type { Ref } from "vue";
import { inject, ref } from "vue";
import { useI18n } from "vue-i18n";
import { THEME_ALREADY_EXISTS_TYPE } from "../../constants";
import type { ThemeInstallationErrorResponse } from "../../types";

const { t } = useI18n();
const queryClient = useQueryClient();
const themeStore = useThemeStore();

const activeTabId = inject<Ref<string>>("activeTabId", ref(""));

const endpoint = "/apis/api.console.halo.run/v1alpha1/themes/install";

const onUploaded = () => {
  Toast.success(t("core.common.toast.install_success"));

  queryClient.invalidateQueries({ queryKey: ["themes"] });
  themeStore.fetchActivatedTheme();

  activeTabId.value = "installed";
};

const onError = (file: UppyFile, response: ErrorResponse) => {
  const body = response.body as ThemeInstallationErrorResponse;

  if (body.type === THEME_ALREADY_EXISTS_TYPE) {
    handleCatchExistsException(body, file.data as File);
  }
};

const handleCatchExistsException = async (
  error: ThemeInstallationErrorResponse,
  file?: File
) => {
  Dialog.info({
    title: t("core.theme.operations.existed_during_installation.title"),
    description: t(
      "core.theme.operations.existed_during_installation.description"
    ),
    confirmText: t("core.common.buttons.confirm"),
    cancelText: t("core.common.buttons.cancel"),
    onConfirm: async () => {
      if (!file) {
        throw new Error("File is required");
      }

      await consoleApiClient.theme.theme.upgradeTheme({
        name: error.themeName,
        file: file,
      });

      Toast.success(t("core.common.toast.upgrade_success"));

      queryClient.invalidateQueries({ queryKey: ["themes"] });
      themeStore.fetchActivatedTheme();

      activeTabId.value = "installed";
    },
  });
};
</script>

<template>
  <div class="pb-3">
    <AppDownloadAlert />
  </div>
  <UppyUpload
    :restrictions="{
      maxNumberOfFiles: 1,
      allowedFileTypes: ['.zip'],
    }"
    :endpoint="endpoint"
    width="100%"
    auto-proceed
    @uploaded="onUploaded"
    @error="onError"
  />
</template>
