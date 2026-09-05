<template>
  <div class="tenant-page">
    <el-card shadow="never">
      <div slot="header">租户管理</div>
      <vxe-table :data="list" :loading="loading" border>
        <vxe-table-column field="id" title="租户 ID" />
        <vxe-table-column field="name" title="租户名称" />
        <vxe-table-column field="status" title="状态" />
      </vxe-table>
    </el-card>
  </div>
</template>

<script>
import { tenantAdminListApi } from '@/api/tenant';

export default {
  name: 'SystemTenant',
  data() {
    return { list: [], loading: false };
  },
  mounted() {
    this.loading = true;
    tenantAdminListApi()
      .then((res) => {
        const data = res.data || res;
        this.list = Array.isArray(data) ? data : data.list || [];
      })
      .finally(() => {
        this.loading = false;
      });
  },
};
</script>
