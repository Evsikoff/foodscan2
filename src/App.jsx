import React, { useState, useRef, useEffect } from 'react';
import {
  View, Panel, PanelHeader, Group, Button, Div, Title, Text,
  Caption, Snackbar, Avatar, SimpleCell, Separator,
  Headline, Subhead, PanelHeaderBack
} from '@vkontakte/vkui';
import {
  Icon28CameraOutline, Icon28RefreshOutline, Icon24ErrorCircleOutline,
  Icon28HistoryBackwardOutline, Icon28DeleteOutline, Icon24ChevronRight
} from '@vkontakte/icons';
import { analyzeFood } from './api/analyzeFood';
import { showNativeAd } from './utils/vkAds';
import { MACRO_COLORS, MACRO_LABELS } from './constants/prompts';
import { loadHistory, saveToHistory, removeFromHistory } from './utils/vkStorage';

export default function App() {
  const [activePanel, setActivePanel] = useState('home');
  const [result, setResult] = useState(null);
  const [insult, setInsult] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const [thinkingText, setThinkingText] = useState('');
  const [history, setHistory] = useState([]);
  const [isFromHistory, setIsFromHistory] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);

  const showError = (text) => {
    setSnackbar(
      <Snackbar
        onClose={() => setSnackbar(null)}
        before={<Avatar size={24} style={{ background: '#e53935' }}><Icon24ErrorCircleOutline fill="#fff" width={16} height={16} /></Avatar>}
      >
        {text}
      </Snackbar>
    );
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setActivePanel('loading');

    try {
      setThinkingText('');
      showNativeAd();
      setIsFromHistory(false);

      const parsed = await analyzeFood(file, (reasoning) => {
        setThinkingText(reasoning);
      });

      if (parsed.is_food) {
        setResult(parsed);
        setActivePanel('food_result');
        const entry = {
          name: parsed.name,
          calories: parsed.calories,
          proteins: parsed.proteins,
          fats: parsed.fats,
          carbs: parsed.carbs,
        };
        saveToHistory(entry).then(setHistory);
      } else {
        setInsult(parsed.insult);
        setActivePanel('insult_result');
      }
    } catch (err) {
      console.error(err);
      showError('Ошибка анализа. Попробуйте другое фото.');
      setActivePanel('home');
    }

    e.target.value = '';
  };

  const handleReset = () => {
    setResult(null);
    setInsult('');
    setPhotoPreview(null);
    setIsFromHistory(false);
    setActivePanel('home');
  };

  const handleDeleteHistoryItem = async (e, id) => {
    e.stopPropagation();
    const updatedHistory = await removeFromHistory(id);
    setHistory(updatedHistory);
  };

  const handleSelectHistoryItem = (item) => {
    setResult(item);
    setPhotoPreview(null); // We don't store images in history for now (VK Storage limit)
    setIsFromHistory(true);
    setActivePanel('food_result');
  };

  const maxMacro = React.useMemo(() => result
    ? Math.max(result.proteins || 0, result.fats || 0, result.carbs || 0, result.fiber || 0, result.sugar || 0, 1)
    : 1, [result]);

  const groupedHistory = React.useMemo(() => history.reduce((acc, item) => {
    const date = new Date(item.date).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    if (!acc[date]) {
      acc[date] = { items: [], totalCalories: 0 };
    }
    acc[date].items.push(item);
    acc[date].totalCalories += item.calories || 0;
    return acc;
  }, {}), [history]);

  return (
    <View activePanel={activePanel}>
      {/* HOME */}
      <Panel id="home">
        <PanelHeader>Нейросканер еды</PanelHeader>
        <Group>
          <Div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF6B6B, #FFA94D)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 48
            }}>
              🍔
            </div>
            <Title level="1" style={{ marginBottom: 8 }}>Нейросканер еды</Title>
            <Text style={{ color: '#888', marginBottom: 24 }}>
              Сфотографируй еду — узнай калории за секунды
            </Text>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <Button
              size="l"
              stretched
              before={<Icon28CameraOutline />}
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'linear-gradient(135deg, #FF6B6B, #FFA94D)',
                borderRadius: 12, marginBottom: 16
              }}
            >
              Анализировать фото 📺
            </Button>

            {history.length > 0 && (
              <Button
                size="l"
                stretched
                mode="secondary"
                before={<Icon28HistoryBackwardOutline />}
                onClick={() => setActivePanel('history')}
                style={{ borderRadius: 12, marginBottom: 16 }}
              >
                История сканирований
              </Button>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              {['⚡ Быстро', '🎯 Точно', '🤖 ИИ'].map((t) => (
                <span key={t} style={{
                  background: '#f0f0f0', borderRadius: 20,
                  padding: '6px 14px', fontSize: 13, color: '#555'
                }}>{t}</span>
              ))}
            </div>
          </Div>
        </Group>

        <Caption
          level="2"
          style={{ textAlign: 'center', color: '#999', padding: '0 20px 20px' }}
        >
          ⚠️ ИИ может ошибаться. Данные являются приблизительными и не заменяют консультацию диетолога.
        </Caption>
        {snackbar}
      </Panel>

      {/* LOADING */}
      <Panel id="loading">
        <PanelHeader>Анализ...</PanelHeader>
        <Group>
          <Div style={{ textAlign: 'center', padding: '60px 20px' }}>
            {photoPreview && (
              <div style={{
                width: 150, height: 150, borderRadius: 20, overflow: 'hidden',
                margin: '0 auto 24px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}>
                <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div style={{
              width: 48, height: 48, margin: '20px auto',
              border: '4px solid #f0f0f0', borderTopColor: '#FF6B6B',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <Title level="2" style={{ marginBottom: 8 }}>Анализируем фото...</Title>
            <Text style={{ color: '#888' }}>
              ИИ определяет состав и калорийность
            </Text>
            {thinkingText && (
              <div style={{
                marginTop: 16, padding: '12px 16px',
                background: '#f5f5f5', borderRadius: 12,
                maxHeight: 120, overflow: 'auto',
                textAlign: 'left'
              }}>
                <Caption level="2" style={{ color: '#aaa', marginBottom: 4 }}>🧠 ИИ думает:</Caption>
                <Text style={{ fontSize: 12, color: '#888', lineHeight: '1.4' }}>
                  {thinkingText.length > 200 ? '...' + thinkingText.slice(-200) : thinkingText}
                </Text>
              </div>
            )}
            <Caption level="2" style={{ color: '#aaa', marginTop: 16 }}>
              📺 Пока показываем рекламу — спасибо за поддержку!
            </Caption>
          </Div>
        </Group>
      </Panel>

      {/* FOOD RESULT */}
      <Panel id="food_result">
        <PanelHeader
          before={isFromHistory ? <PanelHeaderBack onClick={() => setActivePanel('history')} /> : null}
        >
          Результат
        </PanelHeader>
        {result && (
          <>
            {photoPreview && (
              <div style={{
                position: 'relative', height: 220, overflow: 'hidden'
              }}>
                <img src={photoPreview} alt="" style={{
                  width: '100%', height: '100%', objectFit: 'cover'
                }} />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
                  background: 'linear-gradient(transparent, var(--vkui--color_background_content))'
                }} />
                <div style={{
                  position: 'absolute', bottom: 12, left: 16, right: 16
                }}>
                  <Title level="1" style={{ color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                    {result.name}
                  </Title>
                </div>
              </div>
            )}

            <Group>
              <Div>
                <div style={{
                  textAlign: 'center', padding: '16px 0',
                  background: 'linear-gradient(135deg, #FF6B6B15, #FFA94D15)',
                  borderRadius: 16, marginBottom: 16
                }}>
                  <div style={{ fontSize: 42, fontWeight: 800, color: '#FF6B6B' }}>
                    {result.calories}
                  </div>
                  <Subhead style={{ color: '#888' }}>ккал на порцию</Subhead>
                </div>

                <Headline weight="2" style={{ marginBottom: 12 }}>Макронутриенты</Headline>
                {['proteins', 'fats', 'carbs', 'fiber', 'sugar'].map((key) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 14 }}>{MACRO_LABELS[key]}</Text>
                      <Text style={{ fontSize: 14, fontWeight: 600 }}>{result[key] ?? 0} г</Text>
                    </div>
                    <div style={{
                      height: 8, borderRadius: 4, background: '#f0f0f0', overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${((result[key] ?? 0) / maxMacro) * 100}%`,
                        background: MACRO_COLORS[key],
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                ))}
              </Div>

              <Separator />

              {result.ingredients?.length > 0 && (
                <Div>
                  <Headline weight="2" style={{ marginBottom: 12 }}>Ингредиенты</Headline>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {result.ingredients.map((ing, i) => (
                      <span key={i} style={{
                        background: '#f0f0f0', borderRadius: 20,
                        padding: '6px 14px', fontSize: 13
                      }}>{ing}</span>
                    ))}
                  </div>
                </Div>
              )}

              {result.health_tip && (
                <>
                  <Separator />
                  <SimpleCell
                    before={<Avatar size={36} style={{ background: '#E8F5E9' }}>💡</Avatar>}
                    subtitle="Совет"
                    multiline
                  >
                    {result.health_tip}
                  </SimpleCell>
                </>
              )}
            </Group>

            <Caption level="2" style={{ textAlign: 'center', color: '#999', padding: '0 20px 8px' }}>
              ⚠️ ИИ может ошибаться. Данные приблизительные.
            </Caption>

            <Div>
              {history.length > 0 && (
                <Button
                  size="l"
                  stretched
                  mode="secondary"
                  before={<Icon28HistoryBackwardOutline />}
                  onClick={() => setActivePanel('history')}
                  style={{ borderRadius: 12, marginBottom: 12 }}
                >
                  История сканирований
                </Button>
              )}
              <Button
                size="l" stretched mode="secondary"
                before={<Icon28RefreshOutline />}
                onClick={handleReset}
                style={{ borderRadius: 12 }}
              >
                Сканировать ещё
              </Button>
            </Div>
          </>
        )}
        {snackbar}
      </Panel>

      {/* INSULT RESULT */}
      <Panel id="insult_result">
        <PanelHeader>Это не еда!</PanelHeader>
        <Group>
          <Div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 80, marginBottom: 20 }}>🤖</div>
            <Title level="2" style={{ marginBottom: 16 }}>Это не еда!</Title>

            <div style={{
              background: 'linear-gradient(135deg, #FF6B6B10, #FFA94D10)',
              borderRadius: 16, padding: 20, marginBottom: 20,
              borderLeft: '4px solid #FF6B6B'
            }}>
              <Text style={{ fontSize: 16, lineHeight: '1.5', fontStyle: 'italic' }}>
                «{insult}»
              </Text>
            </div>

            {photoPreview && (
              <div style={{
                width: 120, height: 120, borderRadius: 16, overflow: 'hidden',
                margin: '0 auto 20px', opacity: 0.6,
                border: '3px dashed #ccc'
              }}>
                <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <Button
              size="l" stretched
              before={<Icon28RefreshOutline />}
              onClick={handleReset}
              style={{
                background: 'linear-gradient(135deg, #FF6B6B, #FFA94D)',
                borderRadius: 12
              }}
            >
              Попробовать ещё раз
            </Button>
          </Div>
        </Group>

        <Caption level="2" style={{ textAlign: 'center', color: '#999', padding: '0 20px 20px' }}>
          ⚠️ ИИ может ошибаться. Данные приблизительные.
        </Caption>
        {snackbar}
      </Panel>

      {/* HISTORY */}
      <Panel id="history">
        <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}>
          История
        </PanelHeader>
        {Object.keys(groupedHistory).length === 0 ? (
          <Div style={{ textAlign: 'center', marginTop: 40 }}>
            <Text style={{ color: '#888' }}>История пока пуста</Text>
          </Div>
        ) : (
          Object.entries(groupedHistory).map(([date, data]) => (
            <Group key={date} header={
              <Div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 0 }}>
                <Headline weight="2">{date}</Headline>
                <Caption level="1" style={{ color: '#FF6B6B', fontWeight: 600 }}>
                  {data.totalCalories} ккал
                </Caption>
              </Div>
            }>
              {data.items.map((item) => (
                <SimpleCell
                  key={item.id}
                  onClick={() => handleSelectHistoryItem(item)}
                  after={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Text style={{ marginRight: 8, color: '#888' }}>{item.calories} ккал</Text>
                      <Icon28DeleteOutline
                        width={24} height={24}
                        style={{ color: '#E53935' }}
                        onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                      />
                      <Icon24ChevronRight style={{ color: '#BBB' }} />
                    </div>
                  }
                  subtitle={`${item.proteins}П · ${item.fats}Ж · ${item.carbs}У`}
                >
                  {item.name}
                </SimpleCell>
              ))}
            </Group>
          ))
        )}
      </Panel>
    </View>
  );
}
