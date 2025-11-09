/**
 * Settings Screen - Configuration and information
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { GEMINI_API_KEY } from '@env';

export default function SettingsScreen() {
  const isApiConfigured = GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Configuration & About</Text>
      </View>

      {/* API Configuration Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuration</Text>
      </View>

      <GlassCard style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Gemini API</Text>
            <Text style={styles.settingValue}>
              {isApiConfigured ? '✅ Configured' : '⚠️ Not configured'}
            </Text>
          </View>
        </View>

        {!isApiConfigured && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              To enable AI features, add your Gemini API key to the .env file
            </Text>
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => Linking.openURL('https://makersuite.google.com/app/apikey')}
            >
              <Text style={styles.linkText}>Get API Key →</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.settingRow, styles.borderTop]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Data Source</Text>
            <Text style={styles.settingValue}>NASA LLIS + Local Seed</Text>
          </View>
        </View>

        <View style={[styles.settingRow, styles.borderTop]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>AI Model</Text>
            <Text style={styles.settingValue}>Gemini 2.5 Flash</Text>
          </View>
        </View>
      </GlassCard>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About AstroScope</Text>
      </View>

      <GlassCard style={styles.card}>
        <Text style={styles.aboutText}>
          AstroScope is an intelligent conversational interface for NASA's Lessons Learned Information System (LLIS). 
          It uses advanced AI to help engineers and mission planners learn from decades of space mission experience.
        </Text>

        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🔍</Text>
            <Text style={styles.featureText}>Real NASA mission data</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🤖</Text>
            <Text style={styles.featureText}>AI-powered insights</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>⚡</Text>
            <Text style={styles.featureText}>Hybrid data strategy</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🛡️</Text>
            <Text style={styles.featureText}>Offline capability</Text>
          </View>
        </View>
      </GlassCard>

      {/* Data Sources */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resources</Text>
      </View>

      <GlassCard style={styles.card}>
        <TouchableOpacity 
          style={styles.resourceRow}
          onPress={() => Linking.openURL('https://llis.nasa.gov')}
        >
          <Text style={styles.resourceText}>NASA LLIS Database</Text>
          <Text style={styles.resourceIcon}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.resourceRow, styles.borderTop]}
          onPress={() => Linking.openURL('https://ai.google.dev/gemini-api')}
        >
          <Text style={styles.resourceText}>Google Gemini AI</Text>
          <Text style={styles.resourceIcon}>→</Text>
        </TouchableOpacity>
      </GlassCard>

      {/* Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>AstroScope MVP v1.0.0</Text>
        <Text style={styles.versionSubtext}>Built for mission-critical intelligence</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl + 20,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  settingRow: {
    paddingVertical: Spacing.md,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  settingValue: {
    fontSize: Typography.fontSize.md,
    color: Colors.text,
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: 'rgba(255, 184, 0, 0.1)',
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  warningText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.warning,
    marginBottom: Spacing.sm,
  },
  linkButton: {
    alignSelf: 'flex-start',
  },
  linkText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
  },
  aboutText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  featuresList: {
    gap: Spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 20,
    marginRight: Spacing.sm,
  },
  featureText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text,
  },
  resourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  resourceText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text,
  },
  resourceIcon: {
    fontSize: Typography.fontSize.lg,
    color: Colors.primary,
  },
  versionContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  versionText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
  },
  versionSubtext: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
});
