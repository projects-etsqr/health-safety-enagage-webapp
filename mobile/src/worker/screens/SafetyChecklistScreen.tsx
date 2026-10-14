import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/display/Icon';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Colors } from '../theme/colors';
import apiClient from '../api/client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChecklistItem {
  section_name: string;
  item_no: number;
  item_text: string;
  is_required: boolean;
}

interface ChecklistTemplate {
  checklist_type: string;
  display_name: string;
  submitter_roles: string[];
  validator_roles: string[];
  items: ChecklistItem[];
  sla: any;
}

interface DraftSubmission {
  submission_uuid: string;
  status: string;
  submit_due_at: string;
}

type ResponseValue = 'Yes' | 'No' | null;

// ─── Template Card Icons ─────────────────────────────────────────────────────

const TEMPLATE_ICONS: Record<string, string> = {
  worker_pre_shift: '🛡️',
  worker_vehicle_pre_start: '🚛',
  worker_post_shift: '📋',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SafetyChecklistScreen({ navigation }: any) {
  // State: Template list view
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  // State: Checklist fill view
  const [activeTemplate, setActiveTemplate] = useState<ChecklistTemplate | null>(null);
  const [submission, setSubmission] = useState<DraftSubmission | null>(null);
  const [responses, setResponses] = useState<Record<number, ResponseValue>>({});
  // Free-text remark per item, shown below the Yes/No toggle (docx flow 7: "Yes/No plus remarks").
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);

  // ─── Fetch Templates ─────────────────────────────────────────────────────

  useEffect(() => {
    const initialize = async () => {
      let role = '';
      try {
        const workerStorage = require('../utils/storage').TokenStorage;
        const u = await workerStorage.getUser();
        if (u && u.role) role = u.role;
      } catch (e) {}

      if (!role) {
        try {
          const supStorage = require('../../utils/storage').TokenStorage;
          const u = await supStorage.getUser();
          if (u && u.role) role = u.role;
        } catch (e) {}
      }

      setUserRole(role);
      await fetchTemplates(role);
    };

    initialize();
  }, []);

  const fetchTemplates = async (role: string) => {
    try {
      setLoadingTemplates(true);
      const res = await apiClient.get('checklists/templates');
      const all: ChecklistTemplate[] = res.data;
      
      let filtered = all;
      const roleLower = (role || '').toLowerCase();
      
      if (roleLower === 'auditor') {
        filtered = all.filter((t) => t.checklist_type === 'auditor_periodic_audit');
      } else if (roleLower === 'operator' || roleLower === 'worker') {
        const workerTypes = [
          'worker_pre_shift',
          'worker_vehicle_pre_start',
          'worker_post_shift',
        ];
        filtered = all.filter((t) => workerTypes.includes(t.checklist_type));
      } else {
        const excludeWorkerAuditor = [
          'worker_pre_shift',
          'worker_vehicle_pre_start',
          'worker_post_shift',
          'auditor_periodic_audit',
        ];
        filtered = all.filter((t) => !excludeWorkerAuditor.includes(t.checklist_type));
      }

      setTemplates(filtered.length > 0 ? filtered : all);
    } catch (err: any) {
      console.error('CHKLIST_ERR', err?.message, '| status:', err?.response?.status, '| url:', err?.config?.baseURL, err?.config?.url, '| data:', JSON.stringify(err?.response?.data)?.slice(0, 200));
      Alert.alert('Error', 'Failed to load checklist templates. Please try again.');
    } finally {
      setLoadingTemplates(false);
    }
  };

  // ─── Start a Checklist ───────────────────────────────────────────────────

  const startChecklist = async (template: ChecklistTemplate) => {
    try {
      setCreatingDraft(true);
      const res = await apiClient.post('checklists/submissions', {
        checklist_type: template.checklist_type,
      });
      const draft: DraftSubmission = res.data;
      setSubmission(draft);
      setActiveTemplate(template);
      setResponses({});
      setRemarks({});
    } catch (err: any) {
      Alert.alert('Error', 'Failed to create checklist submission. Please try again.');
    } finally {
      setCreatingDraft(false);
    }
  };

  // ─── Set Item Response ───────────────────────────────────────────────────

  const setItemResponse = useCallback((itemNo: number, value: ResponseValue) => {
    setResponses((prev) => ({ ...prev, [itemNo]: value }));
  }, []);

  const setItemRemark = useCallback((itemNo: number, text: string) => {
    setRemarks((prev) => ({ ...prev, [itemNo]: text }));
  }, []);

  // ─── Submit Checklist ────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!submission || !activeTemplate) return;

    // Validate required items are answered
    const unanswered = activeTemplate.items.filter(
      (item) => item.is_required && !responses[item.item_no]
    );
    if (unanswered.length > 0) {
      Alert.alert(
        'Incomplete',
        `Please answer all required items. ${unanswered.length} item(s) remaining.`
      );
      return;
    }

    try {
      setSubmitting(true);

      // Save all answers together with their remarks. Include any item that has either
      // a Yes/No answer or a non-empty remark.
      const itemNos = new Set<number>([
        ...Object.entries(responses).filter(([_, v]) => v !== null).map(([n]) => Number(n)),
        ...Object.entries(remarks).filter(([_, r]) => (r ?? '').trim() !== '').map(([n]) => Number(n)),
      ]);
      const items = Array.from(itemNos).map((itemNo) => ({
        item_no: itemNo,
        response_value: responses[itemNo] ?? null,
        remark: (remarks[itemNo] ?? '').trim() || null,
      }));

      await apiClient.put(
        `checklists/submissions/${submission.submission_uuid}/items`,
        { items }
      );

      // Submit
      await apiClient.post(
        `checklists/submissions/${submission.submission_uuid}/submit`
      );

      Alert.alert('Success', 'Checklist submitted successfully.', [
        { text: 'OK', onPress: () => goBackToList() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to submit checklist. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Navigation ──────────────────────────────────────────────────────────

  const goBackToList = () => {
    setActiveTemplate(null);
    setSubmission(null);
    setResponses({});
    setRemarks({});
  };

  // ─── Render: Template List View ──────────────────────────────────────────

  const renderTemplateList = () => {
    if (loadingTemplates) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.blue} />
          <Text style={styles.loadingText}>Loading checklists...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Safety Checklists</Text>
        <Text style={styles.pageSub}>Select a checklist to begin</Text>

        {templates.map((template) => (
          <TouchableOpacity
            key={template.checklist_type}
            style={styles.templateCard}
            onPress={() => startChecklist(template)}
            activeOpacity={0.7}
          >
            <View style={styles.templateIconContainer}>
              <Icon
                emoji={TEMPLATE_ICONS[template.checklist_type] || '📝'}
                style={styles.templateIcon}
              />
            </View>
            <View style={styles.templateInfo}>
              <Text style={styles.templateName}>{template.display_name}</Text>
              <Text style={styles.templateMeta}>
                {template.items.length} items • SLA: {template.sla?.draft_submission_sla_hours ?? '—'}h
              </Text>
            </View>
            <Text style={styles.templateArrow}>›</Text>
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  // ─── Render: Checklist Fill View ─────────────────────────────────────────

  const renderChecklistFill = () => {
    if (!activeTemplate) return null;

    // Group items by section
    const sections: Record<string, ChecklistItem[]> = {};
    activeTemplate.items.forEach((item) => {
      const section = item.section_name || 'General';
      if (!sections[section]) sections[section] = [];
      sections[section].push(item);
    });

    const answeredCount = Object.values(responses).filter((v) => v !== null).length;
    const totalCount = activeTemplate.items.length;

    return (
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Back button + Title */}
        <TouchableOpacity style={styles.backRow} onPress={goBackToList}>
          <Icon emoji="←" style={styles.backArrow} />
          <Text style={styles.backText}>Back to Checklists</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>{activeTemplate.display_name}</Text>
        <Text style={styles.pageSub}>
          Progress: {answeredCount}/{totalCount} items answered
        </Text>

        {/* Progress Bar */}
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%` },
            ]}
          />
        </View>

        {/* Sections */}
        {Object.entries(sections).map(([sectionName, items]) => (
          <View key={sectionName} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{sectionName}</Text>

            {items.map((item) => (
              <View key={item.item_no} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemText}>
                    {item.item_text}
                    {item.is_required && <Text style={styles.requiredStar}> *</Text>}
                  </Text>
                </View>

                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      responses[item.item_no] === 'Yes' && styles.toggleBtnPass,
                    ]}
                    onPress={() => setItemResponse(item.item_no, 'Yes')}
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        responses[item.item_no] === 'Yes' && styles.toggleBtnTextActive,
                      ]}
                    >
                      Yes
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      responses[item.item_no] === 'No' && styles.toggleBtnFail,
                    ]}
                    onPress={() => setItemResponse(item.item_no, 'No')}
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        responses[item.item_no] === 'No' && styles.toggleBtnTextActive,
                      ]}
                    >
                      No
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Optional remark / description for this item */}
                <TextInput
                  style={styles.remarkInput}
                  placeholder="Add remarks / description (optional)"
                  placeholderTextColor={Colors.textLight}
                  value={remarks[item.item_no] ?? ''}
                  onChangeText={(text) => setItemRemark(item.item_no, text)}
                  multiline
                />
              </View>
            ))}
          </View>
        ))}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>Submit Checklist</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    );
  };

  // ─── Main Render ─────────────────────────────────────────────────────────

  return (
    <ScreenLayout bg={Colors.background}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            if (activeTemplate) {
              goBackToList();
            } else {
              navigation.goBack();
            }
          }}
        >
          <Icon emoji="←" style={styles.headerIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety Checklists</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Loading overlay for draft creation */}
      {creatingDraft && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={Colors.blue} />
          <Text style={styles.overlayText}>Preparing checklist...</Text>
        </View>
      )}

      {/* Content */}
      {activeTemplate ? renderChecklistFill() : renderTemplateList()}
    </ScreenLayout>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerIcon: {
    fontSize: 22,
    color: Colors.textDark,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  scroll: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 4,
  },
  pageSub: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 20,
  },

  // ─── Template List Styles ────────────────────────────────────────────────

  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  templateIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  templateIcon: {
    fontSize: 22,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 4,
  },
  templateMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  templateArrow: {
    fontSize: 24,
    color: Colors.textLight,
    fontWeight: '300',
  },

  // ─── Checklist Fill Styles ───────────────────────────────────────────────

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backArrow: {
    fontSize: 18,
    color: Colors.blue,
    marginRight: 6,
    fontWeight: '600',
  },
  backText: {
    fontSize: 14,
    color: Colors.blue,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMid,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingLeft: 4,
  },
  itemCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemHeader: {
    marginBottom: 12,
  },
  itemText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textDark,
    lineHeight: 20,
  },
  requiredStar: {
    color: Colors.critical,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  toggleBtnPass: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  toggleBtnFail: {
    backgroundColor: Colors.critical,
    borderColor: Colors.critical,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMid,
  },
  toggleBtnTextActive: {
    color: Colors.white,
  },
  remarkInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 13,
    color: Colors.textDark,
    backgroundColor: Colors.background,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: Colors.blue,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },

  // ─── Overlay ─────────────────────────────────────────────────────────────

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  overlayText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textMid,
    fontWeight: '600',
  },
});
