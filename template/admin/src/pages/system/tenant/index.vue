<template>
  <div v-if="isSuperAdmin" class="tenant-page">
    <el-card shadow="never">
      <div slot="header" class="tenant-header">
        <span>租户管理</span>
        <el-button type="primary" size="small" @click="openForm()">新增租户</el-button>
      </div>
      <vxe-table :data="list" :loading="loading" border>
        <vxe-table-column field="id" title="租户 ID" />
        <vxe-table-column field="name" title="租户名称" />
        <vxe-table-column field="status" title="状态">
          <template v-slot="{ row }">
            <el-switch :value="row.status" :active-value="1" :inactive-value="0" @change="changeStatus(row, $event)" />
          </template>
        </vxe-table-column>
        <vxe-table-column title="操作" width="180" fixed="right">
          <template v-slot="{ row }">
            <el-button type="text" @click="credentialsTenant = row">接口凭据</el-button>
            <el-button type="text" @click="openForm(row)">编辑</el-button>
            <el-button type="text" class="danger-text" @click="remove(row)">删除</el-button>
          </template>
        </vxe-table-column>
      </vxe-table>
    </el-card>

    <TenantCredentials
      v-if="credentialsTenant"
      :key="credentialsTenant.id"
      :tenant-id="Number(credentialsTenant.id)"
      :tenant-name="credentialsTenant.name"
      @close="credentialsTenant = null"
    />

    <el-dialog :visible.sync="dialogVisible" :title="form.id ? '编辑租户' : '新增租户'" width="460px">
      <el-form ref="form" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="租户名称" prop="name"><el-input v-model="form.name" maxlength="100" /></el-form-item>
        <el-form-item label="租户编码" prop="code"
          ><el-input v-model="form.code" maxlength="64" :disabled="!!form.id"
        /></el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </span>
    </el-dialog>
  </div>
  <el-alert
    v-else
    title="仅超级管理员可访问租户管理。请从右上角账户菜单管理自身租户接口凭据。"
    type="warning"
    :closable="false"
  />
</template>

<script>
import { tenantAdminListApi, tenantCreateApi, tenantDeleteApi, tenantStatusApi, tenantUpdateApi } from '@/api/tenant';
import TenantCredentials from '@/components/tenantCredentials';

export default {
  name: 'SystemTenant',
  components: { TenantCredentials },
  computed: {
    isSuperAdmin() {
      return [0, '0'].includes((this.$store.state.userInfo.userInfo || {}).level);
    },
  },
  watch: {
    isSuperAdmin: {
      immediate: true,
      handler(value) {
        if (value) this.loadList();
        else {
          this.list = [];
          this.credentialsTenant = null;
        }
      },
    },
  },
  data() {
    return {
      list: [],
      credentialsTenant: null,
      loading: false,
      saving: false,
      dialogVisible: false,
      form: { id: 0, name: '', code: '', status: 1 },
      rules: {
        name: [{ required: true, message: '请输入租户名称', trigger: 'blur' }],
        code: [
          { required: true, message: '请输入租户编码', trigger: 'blur' },
          { pattern: /^[a-zA-Z0-9_-]+$/, message: '编码仅支持字母、数字、下划线和短横线', trigger: 'blur' },
        ],
      },
    };
  },
  methods: {
    loadList() {
      if (!this.isSuperAdmin) return;
      this.loading = true;
      tenantAdminListApi()
        .then((res) => {
          const data = res.data || res;
          if (this.isSuperAdmin) this.list = Array.isArray(data) ? data : data.list || [];
        })
        .catch((error) => this.$message.error(error.msg || '租户列表加载失败'))
        .finally(() => {
          this.loading = false;
        });
    },
    openForm(row) {
      this.form = row
        ? { id: row.id, name: row.name, code: row.code, status: row.status }
        : { id: 0, name: '', code: '', status: 1 };
      this.dialogVisible = true;
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate());
    },
    submit() {
      this.$refs.form.validate((valid) => {
        if (!valid) return;
        this.saving = true;
        const request = this.form.id ? tenantUpdateApi(this.form.id, this.form) : tenantCreateApi(this.form);
        request
          .then(() => {
            this.$message.success(this.form.id ? '租户修改成功' : '租户创建成功');
            this.dialogVisible = false;
            this.loadList();
          })
          .finally(() => {
            this.saving = false;
          });
      });
    },
    changeStatus(row, status) {
      const previous = row.status;
      row.status = status;
      tenantStatusApi(row.id, status).catch(() => {
        row.status = previous;
      });
    },
    remove(row) {
      this.$confirm(`确定删除租户“${row.name}”吗？`, '提示', { type: 'warning' })
        .then(() => tenantDeleteApi(row.id))
        .then(() => {
          this.$message.success('租户删除成功');
          this.loadList();
        });
    },
  },
};
</script>

<style scoped>
.tenant-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.danger-text {
  color: #f56c6c;
}
</style>
