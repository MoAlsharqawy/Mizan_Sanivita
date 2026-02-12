
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { createClient } from '@supabase/supabase-js';
import { 
  Users, UserPlus, Shield, Check, X, Trash2, 
  Edit, Key, Lock, Mail, Save, Loader2, AlertCircle 
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
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>({});

  // Add User State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', fullName: '', role: 'USER' });
  const [isCreating, setIsCreating] = useState(false);
  
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

  // إضافة مستخدم جديد (Shadow Signup)
  const handleCreateUser = async () => {
      if (!newUser.email || !newUser.password || !newUser.fullName) {
          alert("يرجى ملء جميع الحقول");
          return;
      }

      setIsCreating(true);
      try {
          // 1. Create a temporary client to avoid logging out the current admin
          const supabaseUrl = localStorage.getItem('MZN_SUPABASE_URL');
          const supabaseKey = localStorage.getItem('MZN_SUPABASE_KEY');
          
          if (!supabaseUrl || !supabaseKey) throw new Error("إعدادات الاتصال مفقودة");

          const tempClient = createClient(supabaseUrl, supabaseKey, {
              auth: {
                  persistSession: false, // Critical: Don't store this session
                  autoRefreshToken: false,
                  detectSessionInUrl: false
              }
          });

          // 2. Sign up the user
          const { data, error } = await tempClient.auth.signUp({
              email: newUser.email,
              password: newUser.password,
              options: {
                  data: {
                      full_name: newUser.fullName
                  }
              }
          });

          if (error) throw error;

          if (data.user) {
              // 3. Update the role immediately (Trigger creates it as USER by default)
              // We use the MAIN authenticated client here because we have admin rights
              if (newUser.role !== 'USER') {
                  // Wait a bit for the trigger to finish
                  await new Promise(r => setTimeout(r, 1500));
                  
                  await supabase.from('profiles').update({
                      role: newUser.role,
                      full_name: newUser.fullName // Ensure name is synced
                  }).eq('id', data.user.id);
              }

              alert("تم إنشاء المستخدم بنجاح! \nملاحظة: إذا كان تأكيد البريد الإلكتروني مفعلاً في Supabase، يجب على المستخدم تفعيل حسابه.");
              setIsAddOpen(false);
              setNewUser({ email: '', password: '', fullName: '', role: 'USER' });
              fetchUsers();
          }

      } catch (e: any) {
          console.error(e);
          alert("فشل إنشاء المستخدم: " + (e.message || "خطأ غير معروف"));
      } finally {
          setIsCreating(false);
      }
  };

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
           <h3 className="text-lg font-bold text-gray-800">فريق العمل</h3>
           <p className="text-sm text-gray-500">إدارة الموظفين وتحديد صلاحيات الوصول.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 shadow-sm transition-all"
        >
          <UserPlus className="w-4 h-4" /> إضافة مستخدم جديد
        </button>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
           <div className="col-span-2 text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500"/></div>
        ) : users.length === 0 ? (
           <div className="col-span-2 text-center py-10 bg-gray-50 rounded border border-dashed text-gray-400">لا يوجد مستخدمين مسجلين</div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative">
               <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl uppercase">
                        {(user.full_name || user.email || 'U')[0]}
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
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                     {(user.permissions?.length || 0) === 0 && (
                        <span className="text-[10px] text-gray-400 italic">لا توجد صلاحيات خاصة</span>
                     )}
                  </div>
               </div>
            </div>
          ))
        )}
      </div>

      {/* --- ADD USER MODAL --- */}
      {isAddOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <UserPlus className="w-5 h-5" /> مستخدم جديد
                      </h3>
                      <button onClick={() => setIsAddOpen(false)} className="text-blue-200 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="p-6 space-y-4">
                      <div className="bg-blue-50 p-3 rounded-lg flex gap-3 items-start border border-blue-100">
                          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-blue-800 leading-relaxed">
                              سيتم إنشاء حساب جديد في قاعدة البيانات. يمكن للمستخدم تسجيل الدخول فوراً باستخدام البيانات أدناه.
                          </p>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">الاسم الكامل</label>
                          <input 
                              type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                              value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})}
                              placeholder="مثال: أحمد محمد"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">البريد الإلكتروني (اسم المستخدم)</label>
                          <input 
                              type="email" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                              value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                              placeholder="employee@company.com"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">كلمة المرور</label>
                          <input 
                              type="password" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                              value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}
                              placeholder="******"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">الدور الوظيفي</label>
                          <select 
                              className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                              value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}
                          >
                              <option value="USER">مستخدم (User)</option>
                              <option value="MANAGER">مدير فرع (Manager)</option>
                              <option value="ADMIN">أدمن (Admin)</option>
                          </select>
                      </div>

                      <button 
                          onClick={handleCreateUser}
                          disabled={isCreating}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center gap-2 mt-2 disabled:opacity-70"
                      >
                          {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                          إنشاء الحساب
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- EDIT PERMISSIONS MODAL --- */}
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
