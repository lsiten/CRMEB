<template>
  <el-dialog
    title="租户接口凭据"
    :visible="true"
    width="92vw"
    top="8vh"
    custom-class="tenant-credentials-dialog"
    append-to-body
    :show-close="!secret && !busy"
    :close-on-click-modal="false"
    :close-on-press-escape="!secret && !busy"
    @close="close"
  >
    <div class="tenant-credentials-content" :aria-busy="busy">
      <p>租户：{{ tenantName || tenantId }}（ID：{{ tenantId }}）</p>
      <el-alert
        :title="secret ? '密钥仅展示这一次，请立即保存' : '每个租户仅有一组接口凭据'"
        :description="
          secret
            ? '关闭后无法再次查看。请将密钥保存到可信服务端，勿放入公开客户端。'
            : 'app_id 与 client_id 相同。app_secret 仅供可信服务端使用，不可写入 H5、小程序或 App。'
        "
        :type="secret ? 'warning' : 'info'"
        :closable="false"
        show-icon
      />
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="busy" role="status">{{ saving ? '正在提交，请勿关闭或刷新页面…' : '正在读取凭据状态…' }}</p>
      <el-form v-if="info" label-position="top">
        <el-form-item label="凭据状态">
          <span>{{ info.generated ? '已生成' : '未生成' }}</span>
        </el-form-item>
        <el-form-item v-if="info.generated" label="client_id（app_id 同值）" :for="`credential-id-${tenantId}`">
          <el-input :id="`credential-id-${tenantId}`" :value="info.client_id" type="textarea" :rows="2" readonly />
        </el-form-item>
        <el-form-item v-if="secret" label="app_secret（仅展示一次）" :for="`credential-secret-${tenantId}`">
          <el-input
            :id="`credential-secret-${tenantId}`"
            :value="secret"
            type="textarea"
            :rows="3"
            readonly
            autocomplete="off"
          />
        </el-form-item>
        <p v-else-if="info.generated">密钥已隐藏，无法查询。遗失时请重置；重置会使旧密钥和已签发的租户令牌立即失效。</p>
      </el-form>
    </div>
    <div slot="footer" class="tenant-credentials-actions">
      <el-button :disabled="busy" @click="close">{{ secret ? '已安全保存并关闭' : '关闭' }}</el-button>
      <el-button v-if="!secret" :disabled="busy" @click="load">重新查询</el-button>
      <el-button v-if="info && !secret && !error" type="primary" :loading="saving" :disabled="busy" @click="submit">
        {{ info.generated ? '重置密钥' : '生成凭据' }}
      </el-button>
    </div>
  </el-dialog>
</template>

<script>
import { tenantCredentialsApi, tenantCredentialsGenerateApi, tenantCredentialsResetApi } from '@/api/tenant';

export default {
  name: 'TenantCredentials',
  props: {
    tenantId: { type: Number, required: true },
    tenantName: { type: String, default: '' },
  },
  data() {
    return { info: null, secret: '', error: '', loading: false, saving: false, revision: 0 };
  },
  computed: {
    busy() {
      return this.loading || this.saving;
    },
  },
  watch: {
    '$store.state.tenant.current': {
      deep: true,
      handler() {
        this.close();
      },
    },
    '$store.state.userInfo.userInfo': {
      deep: true,
      handler() {
        this.close();
      },
    },
    tenantId() {
      this.invalidate();
      this.load();
    },
    '$route.fullPath'() {
      this.close();
    },
  },
  mounted() {
    this.load();
  },
  beforeDestroy() {
    this.invalidate();
  },
  methods: {
    invalidate() {
      this.revision += 1;
      this.secret = '';
      this.info = null;
      this.loading = false;
      this.saving = false;
    },
    close() {
      this.invalidate();
      this.$emit('close');
    },
    async load() {
      if (this.busy) return;
      this.invalidate();
      if (!Number.isInteger(this.tenantId) || this.tenantId <= 0) {
        this.error = '账号尚未绑定有效租户，请联系平台管理员';
        return;
      }
      const revision = this.revision;
      this.loading = true;
      this.error = '';
      try {
        const { data } = await tenantCredentialsApi(this.tenantId);
        if (revision !== this.revision) return;
        this.info = { generated: data.generated, client_id: data.client_id };
      } catch (error) {
        if (revision === this.revision) this.error = error.msg || '读取失败，请重新查询';
      } finally {
        if (revision === this.revision) this.loading = false;
      }
    },
    async submit() {
      if (this.busy || !this.info || this.secret || this.error) return;
      const revision = this.revision;
      const reset = this.info.generated;
      this.saving = true;
      if (reset) {
        try {
          await this.$confirm(
            '重置后旧密钥和已签发的租户令牌立即失效，客户端需要重新获取令牌。确定继续吗？',
            '重置租户密钥',
            {
              type: 'warning',
              confirmButtonText: '确认重置',
              cancelButtonText: '取消',
            },
          );
        } catch {
          if (revision === this.revision) this.saving = false;
          return;
        }
      }
      if (revision !== this.revision) return;
      try {
        const { data } = await (reset
          ? tenantCredentialsResetApi(this.tenantId)
          : tenantCredentialsGenerateApi(this.tenantId));
        if (revision !== this.revision) return;
        this.info = { generated: true, client_id: data.client_id };
        this.secret = data.app_secret;
      } catch (error) {
        if (revision !== this.revision) return;
        this.error = `${error.msg || '提交结果未确认'}。请先重新查询状态；若已生成但未收到密钥，请确认后重置。`;
      } finally {
        if (revision === this.revision) this.saving = false;
      }
    },
  },
};
</script>

<style>
.tenant-credentials-dialog {
  max-width: 600px;
}
.tenant-credentials-content {
  font-size: 14px;
  overflow-wrap: break-word;
}
.tenant-credentials-content .el-alert__description,
.tenant-credentials-content .el-alert__title {
  color: var(--prev-color-text-regular) !important;
  word-break: normal;
}
.tenant-credentials-content p,
.tenant-credentials-content .el-alert {
  margin-bottom: 16px;
}
.tenant-credentials-content .el-textarea__inner {
  font-family: monospace;
  font-size: 14px;
}
.tenant-credentials-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 16px;
}
.tenant-credentials-actions .el-button + .el-button {
  margin-left: 0;
}
@media (prefers-reduced-motion: reduce) {
  .dialog-fade-enter-active:has(.tenant-credentials-dialog),
  .dialog-fade-leave-active:has(.tenant-credentials-dialog) {
    animation: none;
  }
}
</style>
