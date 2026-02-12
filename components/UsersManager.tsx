
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { 
  Users, UserPlus, Shield, Check, X, Trash2, 
  Edit, Key, Lock, Mail, Save, Loader2 
} from 'lucide-react';

// قائمة الصلاحيات المتاحة في النظام
const ALL_PERMISSIONS = [
  { id: 'VIEW_DASHBOARD', label: 'عرض لوحة التحكم' },
  { id: 'MANAGE_SALES', label: 'إدارة الفواتير والمبيعات' },
  { id: 'MANAGE_INVENTORY', label: 'إدارة المخزون والمنتجات' },
  { id: 'MANAGE_CUSTOMERS', label: 'إدارة العملاء' },
  { id: 'MANAGE_SUPPLIERS', label: 'إدارة الموردين' },
  { id: 'MANAGE_REPS', label: 'إدارة المندوبين' },
  { id: 'MANAGE_WAREHOUSES', label: 'إدارة المخازن' },
  { id: 'MANAGE_CASH', label: 'إدارة الخزينة' },
  { id: 'VIEW_REPORTS', label: 'الاطلاع على التقارير المالية' },
  { id: 'MANAGE_SETTINGS', label: 'تغيير إعدادات النظام' },
  { id: 'MANAGE_USERS', label: 'إدارة المستخدمين والصلاحيات' },
];

export const UsersManager = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>({});
  
  // تحميل المستخدمين
  const fetchUsers = async () => {
    if (!supabase) return;
    setLoading(true);
    // نجلب البيانات من جدول profiles الذي أنشأناه
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // حفظ التعديلات (الصلاحيات)
  const handleSaveUser = async () => {
    if (!currentUser.id || !supabase) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: currentUser.full_name,
        role: currentUser.role,
        permissions: currentUser.permissions
      })
      .eq('id', currentUser.id);

    if (error) {
      alert("خطأ في الحفظ: " + error.message);
    } else {
      setIsEditing(false);
      fetchUsers();
    }
  };

  // تبديل حالة الصلاحية
  const togglePermission = (permId: string) => {
    const currentPerms = currentUser.permissions || [];
    if (currentPerms.includes(permId)) {
      setCurrentUser({
        ...currentUser, 
        permissions: currentPerms.filter((p: string) => p !== permId)
      });
    } else {
      setCurrentUser({
        ...currentUser, 
        permissions: [...currentPerms, permId]
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
           <h3 className="text-lg font-bold text-gray-800">فريق العمل</h3>
           <p className="text-sm text-gray-500">إدارة الموظفين وتحديد صلاحيات الوصول.</p>
        </div>
        {/* زر إضافة مستخدم (ملاحظة: يتطلب خدمة دعوة) */}
        <button 
          onClick={() => alert("لإضافة مستخدم جديد، يرجى استخدام ميزة 'Invite User' في لوحة تحكم Supabase، ثم سيظهر هنا لتعديل صلاحياته.")}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700"
        >
          <UserPlus className="w-4 h-4" /> دعوة موظف جديد
        </button>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
           <div className="col-span-2 text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500"/></div>
        ) : users.length === 0 ? (
           <div className="col-span-2 text-center py-10 bg-gray-50 rounded border border-dashed">لا يوجد مستخدمين</div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative">
               <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">
                        {(user.full_name || user.email || 'U')[0].toUpperCase()}
                     </div>
                     <div>
                        <h4 className="font-bold text-gray-900">{user.full_name || 'مستخدم بدون اسم'}</h4>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3"/> {user.email}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block font-bold
                          ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {user.role || 'USER'}
                        </span>
                     </div>
                  </div>
                  <button 
                    onClick={() => { setCurrentUser(user); setIsEditing(true); }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
               </div>
               
               <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2 font-bold">الصلاحيات النشطة:</p>
                  <div className="flex flex-wrap gap-1">
                     {(user.permissions || []).slice(0, 4).map((p: string) => (
                        <span key={p} className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded">
                           {ALL_PERMISSIONS.find(ap => ap.id === p)?.label || p}
                        </span>
                     ))}
                     {(user.permissions?.length || 0) > 4 && (
                        <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded">+{user.permissions.length - 4} المزيد</span>
                     )}
                  </div>
               </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Edit Permissions */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              
              <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center shrink-0">
                 <h3 className="font-bold text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" /> تعديل الصلاحيات
                 </h3>
                 <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 overflow-y-auto">
                 
                 <div className="mb-6 space-y-3">
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
                       <input 
                         type="text" 
                         value={currentUser.full_name || ''} 
                         onChange={e => setCurrentUser({...currentUser, full_name: e.target.value})}
                         className="w-full border rounded-lg p-2"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">نوع الدور (Role)</label>
                       <select 
                         value={currentUser.role || 'USER'}
                         onChange={e => setCurrentUser({...currentUser, role: e.target.value})}
                         className="w-full border rounded-lg p-2 bg-white"
                       >
                         <option value="USER">مستخدم عادي (User)</option>
                         <option value="MANAGER">مدير فرع (Manager)</option>
                         <option value="ADMIN">مدير نظام (Admin)</option>
                       </select>
                    </div>
                 </div>

                 <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Key className="w-4 h-4" /> تحديد الصلاحيات الدقيقة
                 </h4>
                 
                 <div className="space-y-2">
                    {ALL_PERMISSIONS.map((perm) => {
                       const isActive = (currentUser.permissions || []).includes(perm.id);
                       return (
                          <div 
                             key={perm.id}
                             onClick={() => togglePermission(perm.id)}
                             className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all
                                ${isActive ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-200 hover:bg-gray-50'}
                             `}
                          >
                             <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded flex items-center justify-center border ${isActive ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                                   {isActive && <Check className="w-3 h-3" />}
                                </div>
                                <span className={`text-sm ${isActive ? 'font-bold text-blue-800' : 'text-gray-600'}`}>{perm.label}</span>
                             </div>
                          </div>
                       );
                    })}
                 </div>

              </div>

              <div className="bg-gray-50 px-6 py-4 border-t flex justify-end gap-3 shrink-0">
                 <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">إلغاء</button>
                 <button onClick={handleSaveUser} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm flex items-center gap-2">
                    <Save className="w-4 h-4" /> حفظ التغييرات
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};
